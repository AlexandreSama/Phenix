// src/commands/index.ts
import type {
    ChatInputCommandInteraction,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { ping } from "./ping.js";

export interface Command {
    data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export const commands = new Map<string, Command>([[ping.data.name, ping]]);