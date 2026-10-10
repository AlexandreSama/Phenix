import { describe, expect, it, vi } from "vitest";
import { createErrorRecorder, createErrorThrottle, describeError, type ErrorEventInput } from "../src/telemetry.js";

// Deux fonctions distinctes : deux premières frames différentes dans la stack
function failHere(message: string) {
    return new Error(message);
}
function failThere(message: string) {
    return new Error(message);
}

describe("describeError", () => {
    it("donne la même empreinte quand seuls les IDs et les nombres changent", () => {
        const one = describeError(failHere("Salon 123456789012345678 introuvable (essai 3)"));
        const two = describeError(failHere("Salon 987654321098765432 introuvable (essai 7)"));
        expect(one.fingerprint).toBe(two.fingerprint);
        expect(one.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it("change d'empreinte quand l'erreur vient d'ailleurs", () => {
        const here = describeError(failHere("Salon introuvable"));
        const there = describeError(failThere("Salon introuvable"));
        expect(here.fingerprint).not.toBe(there.fingerprint);
    });

    it("accepte ce qui n'est pas une Error et respecte la taille des colonnes", () => {
        expect(describeError("texte")).toMatchObject({ name: "NonError", message: "texte", stack: null });
        expect(describeError({ code: 42 }).message).toBe('{"code":42}');
        expect(describeError(new Error("x".repeat(50_000))).message).toHaveLength(10_000);
    });
});

describe("createErrorThrottle", () => {
    it("laisse passer 10 occurrences par empreinte et par minute", () => {
        const throttle = createErrorThrottle(10);
        const allowed = Array.from({ length: 25 }, (_, i) => throttle.allow("fp", 1_000 + i)).filter(Boolean);
        expect(allowed).toHaveLength(10);
        expect(throttle.allow("autre", 1_100)).toBe(true);
        expect(throttle.allow("fp", 61_000)).toBe(true);
    });
});

describe("createErrorRecorder", () => {
    it("écrit le contexte sans les valeurs undefined, et écarte un guildId invalide", async () => {
        const written: ErrorEventInput[] = [];
        const record = createErrorRecorder("BOT", async (event) => void written.push(event));
        await record(new Error("a"), { guildId: "123456789012345678", command: "ban", absent: undefined });
        await record(new Error("b"), { guildId: "pas-un-id" });
        expect(written[0]).toMatchObject({ service: "BOT", guildId: "123456789012345678", context: { command: "ban" } });
        expect(written[1]).toMatchObject({ guildId: null, context: undefined });
    });

    it("ne lève jamais, même si l'écriture échoue", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const record = createErrorRecorder("API", async () => {
            throw new Error("base indisponible");
        });
        await expect(record(new Error("pendant la panne"))).resolves.toBeUndefined();
        expect(consoleError).toHaveBeenCalledWith("ErrorEvent non écrit :", expect.any(Error));
        consoleError.mockRestore();
    });
});