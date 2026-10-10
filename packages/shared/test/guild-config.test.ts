import { describe, expect, it } from "vitest";
import { guildConfigPatchSchema } from "../src/guild-config.js";

const messages = (input: unknown) => {
    const result = guildConfigPatchSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("guildConfigPatchSchema", () => {
    it("accepte un patch partiel, et null pour retirer un salon", () => {
        expect(guildConfigPatchSchema.parse({ welcomeChannelId: null, enableLevels: true })).toEqual({
            welcomeChannelId: null,
            enableLevels: true,
        });
    });

    it("refuse les champs que le panel ne doit pas modifier", () => {
        expect(guildConfigPatchSchema.safeParse({ guildId: "123456789012345678" }).success).toBe(false);
        expect(guildConfigPatchSchema.safeParse({ lastCaseId: 999 }).success).toBe(false);
    });

    it("refuse un patch vide et un ID mal formé, avec des messages en français", () => {
        expect(messages({})).toEqual(["Aucun champ à modifier"]);
        expect(messages({ logsChannelId: "12" })).toEqual(["ID Discord invalide"]);
    });

    it("borne le seuil de strikes TD2 entre 1 et 10, en entier", () => {
        expect(guildConfigPatchSchema.safeParse({ td2StrikeThreshold: 10 }).success).toBe(true);
        expect(guildConfigPatchSchema.safeParse({ td2StrikeThreshold: 11 }).success).toBe(false);
        expect(guildConfigPatchSchema.safeParse({ td2StrikeThreshold: 2.5 }).success).toBe(false);
    });
});