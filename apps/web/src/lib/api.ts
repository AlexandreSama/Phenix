import { cookies } from "next/headers";
import type { MeResponse } from "@phenix/shared";

const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

export class ApiError extends Error {
    constructor(
        readonly status: number,
        path: string,
        /** Corps JSON de la réponse d'erreur, s'il y en a un (ex. erreurs de validation) */
        readonly body: unknown = null,
    ) {
        super(`API ${status} sur ${path}`);
    }
}

/** Appel de l'API depuis un composant serveur ou une Server Action, avec le cookie de session du visiteur */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("cookie", (await cookies()).toString());
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
    if (!response.ok) throw new ApiError(response.status, path, await response.json().catch(() => null));
    return (await response.json()) as T;
}

/** Utilisateur connecté, ou null si le visiteur n'a pas de session valide */
export async function getMe(): Promise<MeResponse | null> {
    try {
        return await api<MeResponse>("/me");
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
    }
}