// apps/api/src/auth/auth.controller.ts
import { Controller, Get, Logger, Post, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { Public, SESSION_COOKIE, STATE_COOKIE } from "./decorators.js";
import { SESSION_TTL_SECONDS } from "./session.service.js";

/** N'accepte qu'un chemin du panel, pour qu'un lien piégé ne renvoie pas vers un autre site */
export function safeReturnTo(value: string | undefined): string {
    return value && /^\/(?![/\\])/.test(value) ? value : "/";
}

@Controller("auth")
export class AuthController {
    private readonly logger = new Logger(AuthController.name);
    private readonly webOrigin: string;
    private readonly cookie: CookieOptions;

    constructor(
        private readonly auth: AuthService,
        config: ConfigService,
    ) {
        this.webOrigin = config.getOrThrow<string>("WEB_ORIGIN");
        this.cookie = {
            httpOnly: true, // illisible depuis le JavaScript de la page
            sameSite: "lax", // envoyé au retour de Discord, pas sur les requêtes POST d'autres sites
            secure: this.webOrigin.startsWith("https://"),
            path: "/",
        };
    }

    /** Le bouton « Se connecter » du panel pointe ici */
    @Public()
    @Get("login")
    async login(@Query("returnTo") returnTo: string | undefined, @Res() res: Response) {
        const { state, url } = await this.auth.startLogin(safeReturnTo(returnTo));
        res.cookie(STATE_COOKIE, state, { ...this.cookie, maxAge: 10 * 60 * 1000 });
        res.redirect(url);
    }

    /** Discord renvoie ici le navigateur, avec ?code=…&state=… ou ?error=… */
    @Public()
    @Get("callback")
    async callback(
        @Query("code") code: string | undefined,
        @Query("state") state: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const expectedState = req.cookies?.[STATE_COOKIE] as string | undefined;
        res.clearCookie(STATE_COOKIE, this.cookie);

        // Pas de code (refus sur Discord) ou state différent du cookie : connexion non lancée par ce navigateur
        if (!code || !state || state !== expectedState) {
            return res.redirect(`${this.webOrigin}/?login=failed`);
        }
        try {
            const { sessionToken, returnTo } = await this.auth.finishLogin(code, state);
            res.cookie(SESSION_COOKIE, sessionToken, { ...this.cookie, maxAge: SESSION_TTL_SECONDS * 1000 });
            return res.redirect(`${this.webOrigin}${returnTo}`);
        } catch (error) {
            this.logger.warn(`Connexion Discord échouée : ${error instanceof Error ? error.message : String(error)}`);
            return res.redirect(`${this.webOrigin}/?login=failed`);
        }
    }

    /** Formulaire POST du panel (pas de GET : un lien ou une image ne doit pas pouvoir déconnecter) */
    @Public()
    @Post("logout")
    async logout(@Req() req: Request, @Res() res: Response) {
        const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
        if (token) await this.auth.logout(token);
        res.clearCookie(SESSION_COOKIE, this.cookie);
        res.redirect(303, `${this.webOrigin}/`);
    }
}