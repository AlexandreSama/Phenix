// src/deploy-commands.ts
import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { env } from "./env.js";

const rest = new REST().setToken(env.discordToken);
const body = [...commands.values()].map((command) => command.data.toJSON());

// Avec DISCORD_DEV_GUILD_ID : publication instantanée sur le serveur de test.
// Sans : publication globale, sur tous les serveurs du bot.
const route = env.devGuildId
    ? Routes.applicationGuildCommands(env.discordClientId, env.devGuildId)
    : Routes.applicationCommands(env.discordClientId);

await rest.put(route, { body });
console.log(`${body.length} commande(s) publiée(s)`);