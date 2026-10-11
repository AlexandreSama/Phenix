import { ForbiddenException, NotFoundException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { GuildPanelRole } from "@phenix/database";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { Public, RequireGuildRole, SESSION_COOKIE, type AuthContext } from "./decorators.js";
import type { GuildAccessService } from "./guild-access.service.js";
import { GuildAccessGuard, SessionGuard } from "./guards.js";
import type { SessionService } from "./session.service.js";

const WEB_ORIGIN = "https://panel.example";
const GUILD = "123456789012345678";
const AUTH: AuthContext = { userId: "u1", discordId: "999", platformRole: "USER" };

type FakeRequest = {
    method: string;
    headers: Record<string, string | undefined>;
    cookies?: Record<string, string>;
    params: Record<string, string | string[]>;
    auth?: AuthContext;
};

function request(overrides: Partial<FakeRequest> = {}): FakeRequest {
    return { method: "GET", headers: {}, cookies: {}, params: {}, ...overrides };
}

/** Contexte Nest d'une route décorée comme dans un vrai contrôleur */
function context(req: FakeRequest, ...decorators: MethodDecorator[]): ExecutionContext {
    const handler = () => undefined;
    for (const decorate of decorators) (decorate as (target: object) => void)(handler);
    return {
        getHandler: () => handler,
        getClass: () => class {},
        switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
}

describe("SessionGuard", () => {
    function setup({ session = { userId: "u1", createdAt: 0 } as object | null, user = AUTH as object | null } = {}) {
        const sessions = { get: vi.fn().mockResolvedValue(session), destroy: vi.fn() };
        const prisma = {
            user: { findUnique: vi.fn().mockResolvedValue(user && { discordId: "999", platformRole: "USER" }) },
        };
        const config = { getOrThrow: () => WEB_ORIGIN } as unknown as ConfigService;
        const guard = new SessionGuard(
            new Reflector(),
            sessions as unknown as SessionService,
            prisma as unknown as PrismaService,
            config,
        );
        return { guard, sessions };
    }

    const withSession = (overrides: Partial<FakeRequest> = {}) =>
        request({ cookies: { [SESSION_COOKIE]: "token" }, ...overrides });

    it("laisse passer une route @Public() sans session", async () => {
        const { guard } = setup();
        await expect(guard.canActivate(context(request(), Public()))).resolves.toBe(true);
    });

    it("refuse une modification venue d'une autre origine, même sur une route publique", async () => {
        const { guard } = setup();
        const req = withSession({ method: "POST", headers: { origin: "https://evil.example" } });
        await expect(guard.canActivate(context(req, Public()))).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context(req))).rejects.toThrow(ForbiddenException);
    });

    it("accepte une modification venue du panel, ou sans en-tête Origin", async () => {
        const { guard } = setup();
        const fromPanel = withSession({ method: "PATCH", headers: { origin: WEB_ORIGIN } });
        await expect(guard.canActivate(context(fromPanel))).resolves.toBe(true);
        await expect(guard.canActivate(context(withSession({ method: "PATCH" })))).resolves.toBe(true);
    });

    it("ne vérifie pas l'origine d'une lecture", async () => {
        const { guard } = setup();
        const req = withSession({ headers: { origin: "https://evil.example" } });
        await expect(guard.canActivate(context(req))).resolves.toBe(true);
    });

    it("refuse une requête sans cookie de session", async () => {
        const { guard, sessions } = setup();
        await expect(guard.canActivate(context(request()))).rejects.toThrow(UnauthorizedException);
        expect(sessions.get).not.toHaveBeenCalled();
    });

    it("refuse une session inconnue ou expirée", async () => {
        const { guard } = setup({ session: null });
        await expect(guard.canActivate(context(withSession()))).rejects.toThrow(UnauthorizedException);
    });

    it("détruit la session d'un utilisateur supprimé", async () => {
        const { guard, sessions } = setup({ user: null });
        await expect(guard.canActivate(context(withSession()))).rejects.toThrow(UnauthorizedException);
        expect(sessions.destroy).toHaveBeenCalledWith("token");
    });

    it("attache l'utilisateur à la requête", async () => {
        const { guard } = setup();
        const req = withSession();
        await expect(guard.canActivate(context(req))).resolves.toBe(true);
        expect(req.auth).toEqual(AUTH);
    });
});

describe("GuildAccessGuard", () => {
    function setup({ guild = { leftAt: null } as object | null, role = "ADMIN" as GuildPanelRole | null } = {}) {
        const access = { roleFor: vi.fn().mockResolvedValue(role) };
        const prisma = { guild: { findUnique: vi.fn().mockResolvedValue(guild) } };
        const guard = new GuildAccessGuard(
            new Reflector(),
            access as unknown as GuildAccessService,
            prisma as unknown as PrismaService,
        );
        return { guard, access };
    }

    const onGuild = () => request({ params: { guildId: GUILD }, auth: AUTH });

    it("ne fait rien sur une route sans @RequireGuildRole()", async () => {
        const { guard, access } = setup();
        await expect(guard.canActivate(context(onGuild()))).resolves.toBe(true);
        expect(access.roleFor).not.toHaveBeenCalled();
    });

    it("refuse une route sans :guildId", async () => {
        const { guard } = setup();
        const req = request({ auth: AUTH });
        await expect(guard.canActivate(context(req, RequireGuildRole("VIEWER")))).rejects.toThrow(ForbiddenException);
    });

    it("répond 404 si Phenix n'est pas, ou plus, sur le serveur", async () => {
        for (const guild of [null, { leftAt: new Date() }]) {
            const { guard } = setup({ guild });
            await expect(guard.canActivate(context(onGuild(), RequireGuildRole("VIEWER")))).rejects.toThrow(
                NotFoundException,
            );
        }
    });

    it("refuse un utilisateur sans accès au serveur", async () => {
        const { guard } = setup({ role: null });
        await expect(guard.canActivate(context(onGuild(), RequireGuildRole("VIEWER")))).rejects.toThrow(
            ForbiddenException,
        );
    });

    it("compare les rôles : VIEWER < MODERATOR < ADMIN", async () => {
        const cases: [GuildPanelRole, GuildPanelRole, boolean][] = [
            ["VIEWER", "VIEWER", true],
            ["VIEWER", "MODERATOR", false],
            ["MODERATOR", "MODERATOR", true],
            ["MODERATOR", "ADMIN", false],
            ["ADMIN", "VIEWER", true],
            ["ADMIN", "ADMIN", true],
        ];
        for (const [role, required, allowed] of cases) {
            const { guard, access } = setup({ role });
            const result = guard.canActivate(context(onGuild(), RequireGuildRole(required)));
            if (allowed) await expect(result, `${role} pour ${required}`).resolves.toBe(true);
            else await expect(result, `${role} pour ${required}`).rejects.toThrow(ForbiddenException);
            expect(access.roleFor).toHaveBeenCalledWith(AUTH, GUILD);
        }
    });
});
