// apps/api/src/auth/crypto.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Jeton aléatoire imprévisible (sessions, state OAuth2) */
export function randomToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
    return createHash("sha256").update(value).digest("base64url");
}

/**
 * Chiffrement des tokens Discord avant stockage en base (AES-256-GCM).
 * Format : "v1.<iv>.<tag>.<texte chiffré>", chaque partie en base64url.
 * Le tag GCM fait échouer le déchiffrement si la valeur a été modifiée.
 */
export class TokenCipher {
    private readonly key: Buffer;

    constructor(base64Key: string) {
        this.key = Buffer.from(base64Key, "base64");
        if (this.key.length !== 32) {
            throw new Error("TOKEN_ENCRYPTION_KEY doit faire 32 octets : openssl rand -base64 32");
        }
    }

    encrypt(plain: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.key, iv);
        const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();
        return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
    }

    decrypt(payload: string): string {
        const [version, iv, tag, data] = payload.split(".");
        if (version !== "v1" || !iv || !tag || !data) throw new Error("Format de token chiffré inconnu");
        const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    }
}