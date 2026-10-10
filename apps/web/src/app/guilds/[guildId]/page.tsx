// apps/web/src/app/guilds/[guildId]/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import type { GuildConfigResponse, GuildDiscordResources, PanelGuild } from "@phenix/shared";
import { api, ApiError, getMe } from "@/lib/api";
import { ConfigForm } from "./config-form";

// Props typées à la main : le type global PageProps n'existe qu'après `next typegen`
export default function GuildPage({ params }: { params: Promise<{ guildId: string }> }) {
    return (
        <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
                ← Mes serveurs
            </Link>
            {/* Cache Components : params et cookies sont lus à la requête, donc dans un Suspense */}
            <Suspense fallback={<p className="text-zinc-500">Chargement de la configuration…</p>}>
                {params.then(({ guildId }) => (
                    <GuildConfigLoader guildId={guildId} />
                ))}
            </Suspense>
        </main>
    );
}

async function GuildConfigLoader({ guildId }: { guildId: string }) {
    const me = await getMe();
    if (!me) {
        return (
            <a href={`/api/auth/login?returnTo=/guilds/${guildId}`} className="text-indigo-600 underline">
                Connectez-vous pour configurer ce serveur
            </a>
        );
    }

    // Le rôle vient de la même liste que la page d'accueil ; l'API revérifie tout de toute façon
    const guilds = await api<PanelGuild[]>("/me/guilds");
    const guild = guilds.find((entry) => entry.id === guildId && entry.botPresent);
    const role = me.platformRole === "DEVELOPER" ? "ADMIN" : guild?.role;
    if (!role) return <p>Ce serveur n’est pas accessible avec votre compte.</p>;

    const data = await loadConfig(guildId);
    if (!data) return <p>Discord ne répond pas pour le moment. Rechargez la page dans un instant.</p>;
    return (
        <ConfigForm
            guildId={guildId}
            guildName={guild?.name ?? guildId}
            canEdit={role === "ADMIN"}
            initialConfig={data.config}
            resources={data.resources}
        />
    );
}

/** Config et salons du serveur, ou null si Discord est indisponible (503) */
async function loadConfig(guildId: string) {
    const id = encodeURIComponent(guildId);
    try {
        const [config, resources] = await Promise.all([
            api<GuildConfigResponse>(`/guilds/${id}/config`),
            api<GuildDiscordResources>(`/guilds/${id}/discord`),
        ]);
        return { config, resources };
    } catch (error) {
        if (error instanceof ApiError && error.status === 503) return null;
        throw error;
    }
}