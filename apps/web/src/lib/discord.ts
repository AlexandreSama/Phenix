// Lien d'invitation du bot, construit côté serveur à partir de DISCORD_CLIENT_ID

/**
 * Permissions demandées à l'invitation, une ligne par besoin.
 * 2 ** n plutôt que 1 << n : en JavaScript, << s'arrête à 32 bits et 1 << 40 vaut 256.
 */
const BOT_PERMISSIONS = [
    2 ** 1, // KICK_MEMBERS : expulser (modération)
    2 ** 2, // BAN_MEMBERS : bannir, et lever les bans temporaires
    2 ** 4, // MANAGE_CHANNELS : salons de tickets, salons vocaux de raid
    2 ** 10, // VIEW_CHANNEL
    2 ** 11, // SEND_MESSAGES
    2 ** 14, // EMBED_LINKS : messages enrichis (giveaways, raids, logs)
    2 ** 16, // READ_MESSAGE_HISTORY
    2 ** 28, // MANAGE_ROLES : rôles automatiques, récompenses de niveau
    2 ** 40, // MODERATE_MEMBERS : mutes (exclusion temporaire de Discord)
].reduce((sum, bit) => sum + bit, 0);

/**
 * Lien qui ajoute Phenix à un serveur, ou null si DISCORD_CLIENT_ID n'est pas défini.
 * Avec guildId, Discord présélectionne ce serveur.
 */
export function botInviteUrl(guildId?: string): string | null {
    const clientId = process.env["DISCORD_CLIENT_ID"];
    if (!clientId) return null;

    const params = new URLSearchParams({
        client_id: clientId,
        scope: "bot applications.commands",
        permissions: String(BOT_PERMISSIONS),
    });
    if (guildId) {
        params.set("guild_id", guildId);
        params.set("disable_guild_select", "true");
    }
    // Discord attend les scopes séparés par %20 ; URLSearchParams encode l'espace en "+"
    return `https://discord.com/oauth2/authorize?${params.toString().replaceAll("+", "%20")}`;
}
