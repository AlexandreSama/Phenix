import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./auth.controller.js";

describe("safeReturnTo", () => {
    it("garde les chemins du panel", () => {
        expect(safeReturnTo("/")).toBe("/");
        expect(safeReturnTo("/guilds/123")).toBe("/guilds/123");
        expect(safeReturnTo("/guilds/123?tab=logs#top")).toBe("/guilds/123?tab=logs#top");
    });

    it("renvoie à l'accueil sans valeur", () => {
        expect(safeReturnTo(undefined)).toBe("/");
        expect(safeReturnTo("")).toBe("/");
    });

    it("refuse tout ce qui mènerait vers un autre site", () => {
        for (const value of [
            "https://evil.example",
            "//evil.example",
            "/\\evil.example",
            "\\\\evil.example",
            "evil.example",
            "javascript:alert(1)",
        ]) {
            expect(safeReturnTo(value), value).toBe("/");
        }
    });
});
