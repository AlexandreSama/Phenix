import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TokenCipher } from "./crypto.js";

const KEY = randomBytes(32).toString("base64");

describe("TokenCipher", () => {
    it("déchiffre ce qu'il a chiffré", () => {
        const cipher = new TokenCipher(KEY);
        const encrypted = cipher.encrypt("token-discord");
        expect(encrypted).toMatch(/^v1\./);
        expect(encrypted).not.toContain("token-discord");
        expect(cipher.decrypt(encrypted)).toBe("token-discord");
    });

    it("change d'IV à chaque chiffrement", () => {
        const cipher = new TokenCipher(KEY);
        expect(cipher.encrypt("même valeur")).not.toBe(cipher.encrypt("même valeur"));
    });

    it("refuse une valeur modifiée", () => {
        const cipher = new TokenCipher(KEY);
        const [version, iv, tag, data] = cipher.encrypt("token-discord").split(".");
        const flipped = Buffer.from(data!, "base64url");
        flipped[0]! ^= 1;
        expect(() => cipher.decrypt([version, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
    });

    it("refuse une valeur chiffrée avec une autre clé", () => {
        const encrypted = new TokenCipher(KEY).encrypt("token-discord");
        expect(() => new TokenCipher(randomBytes(32).toString("base64")).decrypt(encrypted)).toThrow();
    });

    it("refuse un format inconnu", () => {
        expect(() => new TokenCipher(KEY).decrypt("v2.a.b.c")).toThrow("Format de token chiffré inconnu");
        expect(() => new TokenCipher(KEY).decrypt("en clair")).toThrow("Format de token chiffré inconnu");
    });

    it("exige une clé de 32 octets", () => {
        expect(() => new TokenCipher(randomBytes(16).toString("base64"))).toThrow("32 octets");
    });
});
