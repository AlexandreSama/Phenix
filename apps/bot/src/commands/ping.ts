// src/commands/ping.ts
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";

export const ping = {
    data: new SlashCommandBuilder().setName("ping").setDescription("Vérifie que Phenix répond"),
    async execute(interaction) {
        await interaction.reply({
            content: `Pong ! Latence gateway : ${interaction.client.ws.ping} ms`,
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies Command;