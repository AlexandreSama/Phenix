function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
    return value;
}

export const env = {
    discordToken: required("DISCORD_TOKEN"),
    discordClientId: required("DISCORD_CLIENT_ID"),
    devGuildId: process.env["DISCORD_DEV_GUILD_ID"],
    databaseUrl: required("DATABASE_URL"),
    redisUrl: required("REDIS_URL"),
};