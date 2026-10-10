import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import type { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createPrismaClient } from "@phenix/database";
import { METRICS, redisKeys, utcDay } from "@phenix/shared";
import { commands } from "./commands/index.js";
import { ConfigCache } from "./config-cache.js";
import { env } from "./env.js";
import { startScheduler } from "./scheduler.js";

const prisma = createPrismaClient(env.databaseUrl);
const redis = new Redis(env.redisUrl);
const subscriber = new Redis(env.redisUrl); // une connexion abonnée ne sert qu'au pub/sub
const configs = new ConfigCache(prisma);
let scheduler: Worker | undefined;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // privilégié : bienvenue, rôles d'arrivée
        GatewayIntentBits.GuildMessages, // XP (le contenu des messages n'est pas lu)
    ],
});

client.once(Events.ClientReady, async (ready) => {
    // Rattrape les serveurs rejoints ou mis à jour pendant que le bot était hors ligne
    for (const guild of ready.guilds.cache.values()) {
        await prisma.guild.upsert({
            where: { id: guild.id },
            create: { id: guild.id, name: guild.name, ownerId: guild.ownerId, memberCount: guild.memberCount },
            update: { name: guild.name, memberCount: guild.memberCount, leftAt: null },
        });
    }
    await configs.listen(subscriber);
    scheduler = startScheduler(env.redisUrl, ready, prisma);
    console.log(`Phenix connecté : ${ready.user.tag} sur ${ready.guilds.cache.size} serveurs`);
});

client.on(Events.GuildCreate, async (guild) => {
    await prisma.guild.upsert({
        where: { id: guild.id },
        create: { id: guild.id, name: guild.name, ownerId: guild.ownerId, memberCount: guild.memberCount },
        update: { name: guild.name, memberCount: guild.memberCount, joinedAt: new Date(), leftAt: null },
    });
    await prisma.guildBotEvent.create({
        data: { guildId: guild.id, type: "JOINED", memberCount: guild.memberCount },
    });
});

client.on(Events.GuildDelete, async (guild) => {
    await prisma.guild.update({ where: { id: guild.id }, data: { leftAt: new Date() } });
    await prisma.guildBotEvent.create({
        data: { guildId: guild.id, type: "LEFT", memberCount: guild.memberCount },
    });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;

    const startedAt = performance.now();
    let errorCode: string | null = null;
    try {
        await command.execute(interaction);
    } catch (error) {
        errorCode = error instanceof Error ? error.name : "UnknownError";
        console.error(error);
        const reply = { content: "Une erreur est survenue.", flags: MessageFlags.Ephemeral } as const;
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
        else await interaction.reply(reply);
    } finally {
        // Télémétrie : une erreur ici ne doit jamais remonter à l'utilisateur
        void prisma.interactionEvent
            .create({
                data: {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    kind: "SLASH_COMMAND",
                    name: interaction.commandName,
                    subcommand: interaction.options.getSubcommand(false),
                    success: errorCode === null,
                    errorCode,
                    durationMs: Math.round(performance.now() - startedAt),
                },
            })
            .catch(() => {});
        if (interaction.guildId) {
            void redis
                .hincrby(redisKeys.dailyCounters(utcDay(), interaction.guildId), METRICS.interactions, 1)
                .catch(() => {});
        }
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot) return;
    const config = await configs.get(message.guildId);
    if (config && !config.enableLevels) return;

    const day = utcDay();
    await redis.hincrby(redisKeys.dailyCounters(day, message.guildId), METRICS.messages, 1);
    await redis.pfadd(redisKeys.dailyActiveUsers(day, message.guildId), message.author.id);

    // Une seule fois par minute et par membre : la clé expire au bout de 60 s
    const cooldown = redisKeys.xpCooldown(message.guildId, message.author.id);
    if ((await redis.set(cooldown, "1", "EX", 60, "NX")) === null) return;

    const xp = 15 + Math.floor(Math.random() * 11); // 15 à 25 XP
    await prisma.guildLevel.upsert({
        where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
        create: { guildId: message.guildId, userId: message.author.id, totalXp: xp },
        update: { totalXp: { increment: xp } },
    });
    await redis.hincrby(redisKeys.dailyCounters(day, message.guildId), METRICS.xpGained, xp);
});

// Arrêt propre : Docker envoie SIGTERM avant de couper le conteneur
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
        await scheduler?.close();
        await client.destroy();
        await prisma.$disconnect();
        redis.disconnect();
        subscriber.disconnect();
        process.exit(0);
    });
}

await client.login(env.discordToken);