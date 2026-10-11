// apps/web/src/app/guilds/[guildId]/page.tsx
import { Suspense, type ReactNode } from "react";
import type { GuildConfigResponse, GuildDiscordResources, PanelGuild } from "@phenix/shared";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { api, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/viewer";
import { Dashboard } from "./dashboard";

// Props typées à la main : le type global PageProps n'existe qu'après `next typegen`
export default function GuildPage({ params }: { params: Promise<{ guildId: string }> }) {
    return (
        // Cache Components : params et cookies sont lus à la requête, donc dans un Suspense
        <Suspense
            fallback={
                <div className="ph-page grid min-h-full flex-1 place-items-center">
                    <p className="text-doux">Chargement du tableau de bord…</p>
                </div>
            }
        >
            {params.then(({ guildId }) => (
                <GuildDashboard guildId={guildId} />
            ))}
        </Suspense>
    );
}

async function GuildDashboard({ guildId }: { guildId: string }) {
    const me = await getViewer();
    if (!me) {
        return (
            <Notice
                title="Connectez-vous pour configurer ce serveur"
                action={{ href: `/api/auth/login?returnTo=/guilds/${guildId}`, label: "Se connecter avec Discord" }}
            >
                Le panel utilise votre compte Discord pour savoir quels serveurs vous gérez.
            </Notice>
        );
    }

    // Le rôle vient de la même liste que /servers ; l'API revérifie tout de toute façon
    const guilds = (await api<PanelGuild[]>("/me/guilds")).filter((entry) => entry.botPresent);
    const guild = guilds.find((entry) => entry.id === guildId);
    const role = me.platformRole === "DEVELOPER" ? "ADMIN" : guild?.role;
    if (!role) {
        return (
            <Notice title="Ce serveur n'est pas accessible avec votre compte" action={{ href: "/servers", label: "Voir mes serveurs" }}>
                Phenix n&apos;y est pas, ou vous n&apos;avez pas de rôle de gestion sur ce serveur.
            </Notice>
        );
    }

    const data = await loadConfig(guildId);
    if (!data) {
        return <Notice title="Discord ne répond pas pour le moment">Rechargez la page dans un instant.</Notice>;
    }

    return (
        <Dashboard
            guild={{ id: guildId, name: guild?.name ?? guildId, iconUrl: guild?.iconUrl ?? null }}
            role={role}
            me={me}
            guilds={guilds.map(({ id, name, iconUrl }) => ({ id, name, iconUrl }))}
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

function Notice({
                    title,
                    action,
                    children,
                }: {
    title: string;
    action?: { href: string; label: string };
    children: ReactNode;
}) {
    return (
        <div className="ph-page flex min-h-full flex-1 flex-col">
            <SiteHeader />
            <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
                <div className="ph-glass max-w-xl p-8">
                    <h1 className="text-2xl font-extrabold">{title}</h1>
                    <p className="mt-2 text-doux">{children}</p>
                    {action && (
                        // Lien classique : la connexion passe par des redirections vers Discord
                        <a href={action.href} className="ph-btn ph-btn-primary mt-6 px-6 py-3.5">
                            {action.label}
                        </a>
                    )}
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}