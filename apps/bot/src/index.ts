import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { Redis } from "ioredis";
import { createPrismaClient } from "@phenix/database";
import { METRICS, redisKeys} from "@phenix/shared";
import { countDaily, markActive } from "./metrics.js";
import { startScheduler, type Scheduler } from "./scheduler.js";
import { commands } from "./commands/index.js";
import { ConfigCache } from "./config-cache.js";
import { env } from "./env.js";
import { createErrorRecorder } from "@phenix/shared/telemetry";
import { installProcessHandlers, startSampling } from "./telemetry.js";

const prisma = createPrismaClient(env.databaseUrl);
const redis = new Redis(env.redisUrl);
const subscriber = new Redis(env.redisUrl); // une connexion abonnée ne sert qu'au pub/sub
const configs = new ConfigCache(prisma);
const recordError = createErrorRecorder("BOT", (data) => prisma.errorEvent.create({ data }));
installProcessHandlers(recordError);
let scheduler: Scheduler | undefined;
let sampling: ReturnType<typeof startSampling> | undefined;

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
    scheduler = await startScheduler({ redisUrl: env.redisUrl, redis, client: ready, prisma, recordError });
    sampling = startSampling(prisma, ready);
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
    // Upsert : le serveur peut manquer en base (rejoint puis quitté pendant que le bot était hors ligne)
    const leftAt = new Date();
    await prisma.guild.upsert({
        where: { id: guild.id },
        create: { id: guild.id, name: guild.name, ownerId: guild.ownerId, memberCount: guild.memberCount, leftAt },
        update: { leftAt },
    });
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
        void recordError(error, { guildId: interaction.guildId, command: interaction.commandName });
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
        if (interaction.guildId) countDaily(redis, interaction.guildId, METRICS.interactions);
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot) return;

    // Stats d'activité : comptées même quand les niveaux sont désactivés
    countDaily(redis, message.guildId, METRICS.messages);
    markActive(redis, message.guildId, message.author.id);

    const config = await configs.get(message.guildId);
    if (config && !config.enableLevels) return;

    // Une seule fois par minute et par membre : la clé expire au bout de 60 s
    const cooldown = redisKeys.xpCooldown(message.guildId, message.author.id);
    if ((await redis.set(cooldown, "1", "EX", 60, "NX")) === null) return;

    const xp = 15 + Math.floor(Math.random() * 11); // 15 à 25 XP
    await prisma.guildLevel.upsert({
        where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
        create: { guildId: message.guildId, userId: message.author.id, totalXp: xp },
        update: { totalXp: { increment: xp } },
    });
    countDaily(redis, message.guildId, METRICS.xpGained, xp);
});

// Exige l'intent privilégié GuildMembers, déjà demandé plus haut
client.on(Events.GuildMemberAdd, (member) => {
    countDaily(redis, member.guild.id, METRICS.membersJoined);
});

client.on(Events.GuildMemberRemove, (member) => {
    countDaily(redis, member.guild.id, METRICS.membersLeft); // départ, kick ou ban
});

// Sans écouteur, une erreur émise par le client (WebSocket, REST) ferait planter le process
client.on(Events.Error, (error) => {
    console.error("Client Discord :", error);
    void recordError(error, { source: "discord.js" });
});

// Arrêt propre : Docker envoie SIGTERM avant de couper le conteneur
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
        sampling?.stop();
        await scheduler?.close();
        await client.destroy();
        await prisma.$disconnect();
        redis.disconnect();
        subscriber.disconnect();
        process.exit(0);
    });
}

await client.login(env.discordToken);