// Noms affichés : sans dépendance serveur, utilisable aussi dans les composants client
import type { MeResponse } from "@phenix/shared";

export function displayName(me: MeResponse): string {
    return me.globalName ?? me.username;
}

/** Deux initiales, pour les serveurs et comptes sans image ; « Bac à sable » donne « BS » */
export function initials(name: string): string {
    const words = name.split(/\s+/).filter(Boolean);
    const significant = words.filter((word) => Array.from(word).length > 2);
    return (significant.length > 0 ? significant : words)
        .slice(0, 2)
        .map((word) => Array.from(word)[0])
        .join("")
        .toUpperCase();
}