// src/lib/api.ts
const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

/** Appel de l'API Phenix depuis un composant serveur */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status} sur ${path}`);
    return (await response.json()) as T;
}