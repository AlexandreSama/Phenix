// apps/api/src/auth/discord.service.ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const DISCORD_API = "https://discord.com/api/v10";
// Permissions Discord qui donnent le droit de configurer un serveur
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

export interface DiscordTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number; // secondes
    token_type: "Bearer";
    scope: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
    locale?: string;
}

export interface DiscordPartialGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string; // champ de bits, sous forme de chaîne
}

export class DiscordApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: string,
    ) {
        super(`Discord a répondu ${status}`);
    }
}

@Injectable()
export class DiscordService {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;

    constructor(config: ConfigService) {
        this.clientId = config.getOrThrow<string>("DISCORD_CLIENT_ID");
        this.clientSecret = config.getOrThrow<string>("DISCORD_CLIENT_SECRET");
        // Discord renvoie le navigateur sur le panel, qui relaie /api/* vers l'API
        this.redirectUri = `${config.getOrThrow<string>("WEB_ORIGIN")}/api/auth/callback`;
    }

    authorizeUrl(state: string): string {
        const params = new URLSearchParams({
            response_type: "code",
            client_id: this.clientId,
            scope: "identify guilds",
            redirect_uri: this.redirectUri,
            state,
            prompt: "none", // ne redemande pas l'autorisation si elle a déjà été donnée
        });
        // Discord attend les scopes séparés par %20 ; URLSearchParams encode l'espace en "+"
        return `https://discord.com/oauth2/authorize?${params.toString().replaceAll("+", "%20")}`;
    }

    exchangeCode(code: string): Promise<DiscordTokens> {
        return this.postForm("/oauth2/token", {
            grant_type: "authorization_code",
            code,
            redirect_uri: this.redirectUri,
        });
    }

    refresh(refreshToken: string): Promise<DiscordTokens> {
        return this.postForm("/oauth2/token", { grant_type: "refresh_token", refresh_token: refreshToken });
    }

    getUser(accessToken: string): Promise<DiscordUser> {
        return this.get("/users/@me", accessToken);
    }

    getGuilds(accessToken: string): Promise<DiscordPartialGuild[]> {
        return this.get("/users/@me/guilds", accessToken);
    }

    /** Propriétaire, administrateur ou « Gérer le serveur » */
    static canManage(guild: DiscordPartialGuild): boolean {
        const permissions = BigInt(guild.permissions);
        return guild.owner || (permissions & ADMINISTRATOR) !== 0n || (permissions & MANAGE_GUILD) !== 0n;
    }

    private async postForm<T>(path: string, params: Record<string, string>): Promise<T> {
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
        const response = await fetch(`${DISCORD_API}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded", // seul format accepté par Discord ici
                Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams(params),
        });
        if (!response.ok) throw new DiscordApiError(response.status, await response.text());
        return (await response.json()) as T;
    }

    private async get<T>(path: string, accessToken: string): Promise<T> {
        const response = await fetch(`${DISCORD_API}${path}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new DiscordApiError(response.status, await response.text());
        return (await response.json()) as T;
    }
}