// src/app/servers/page.tsx : les serveurs de l'utilisateur connecté, et ceux où Phenix manque encore
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import type { PanelGuild, PanelRole } from "@phenix/shared";
import { INVITE_URL, LOGIN_URL, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { api } from "@/lib/api";
import { displayName, getViewer, initials } from "@/lib/viewer";

const ROLE_LABELS: Record<PanelRole, string> = {
    ADMIN: "Administrateur",
    MODERATOR: "Modérateur",
    VIEWER: "Lecture seule",
};

export default function ServersPage() {
    return (
        <div className="ph-page flex min-h-full flex-1 flex-col">
            <SiteHeader />
            <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
                {/* Cache Components : la lecture des cookies doit être dans un Suspense */}
                <Suspense fallback={<p className="text-doux">Chargement de vos serveurs…</p>}>
                    <ServerList />
                </Suspense>
            </main>
            <SiteFooter />
        </div>
    );
}

async function ServerList() {
    const me = await getViewer();
    if (!me) {
        return (
            <div className="ph-glass max-w-xl p-8">
                <h1 className="text-2xl font-extrabold">Connectez-vous pour voir vos serveurs</h1>
                <p className="mt-2 text-doux">Le panel affiche les serveurs que vous gérez avec votre compte Discord.</p>
                <a href={LOGIN_URL} className="ph-btn ph-btn-primary mt-6 px-6 py-3.5">
                    Se connecter avec Discord
                </a>
            </div>
        );
    }

    const guilds = await api<PanelGuild[]>("/me/guilds");
    const withBot = guilds.filter((guild) => guild.botPresent);
    const withoutBot = guilds.filter((guild) => !guild.botPresent);

    let lead = "Choisissez le serveur à configurer.";
    if (guilds.length === 0) lead = "Aucun serveur à afficher pour l'instant. Phenix liste ici les serveurs que vous gérez.";
    else if (withBot.length === 0) lead = "Phenix n'est encore sur aucun de vos serveurs. Invitez-le pour le configurer ici.";

    return (
        <>
            <h1 className="text-[clamp(2.25rem,4.5vw,3.25rem)] font-extrabold leading-[1.08] tracking-[-0.025em]">
                Bonjour, {displayName(me)}.
            </h1>
            <p className="mt-4 max-w-[34em] text-lg text-doux">{lead}</p>
            {guilds.length === 0 && (
                <a href={INVITE_URL} className="ph-btn ph-btn-primary mt-8 px-6 py-3.5">
                    Ajouter Phenix à Discord
                </a>
            )}

            {withBot.length > 0 && (
                <section aria-labelledby="avec-phenix" className="mt-12">
                    <h2 id="avec-phenix" className="text-xl font-bold">
                        Vos serveurs
                    </h2>
                    <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {withBot.map((guild) => (
                            <li key={guild.id}>
                                <Link
                                    href={`/guilds/${guild.id}`}
                                    className="ph-glass group flex items-center gap-4 rounded-[1.25rem] px-4 py-3.5 transition-colors hover:bg-white/[0.07]"
                                >
                                    <GuildIcon guild={guild} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-bold">{guild.name}</span>
                                        <span className="block text-sm text-doux">{ROLE_LABELS[guild.role]}</span>
                                    </span>
                                    <ChevronRight
                                        aria-hidden="true"
                                        className="size-5 shrink-0 text-discret transition-transform group-hover:translate-x-0.5 group-hover:text-texte"
                                    />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {withoutBot.length > 0 && (
                <section aria-labelledby="sans-phenix" className="mt-12">
                    <h2 id="sans-phenix" className="text-xl font-bold">
                        Sans Phenix pour l&apos;instant
                    </h2>
                    <p className="mt-1 text-doux">Vous gérez ces serveurs, mais Phenix n&apos;y est pas encore.</p>
                    <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {withoutBot.map((guild) => (
                            // Bordure en pointillés : une place qui attend encore Phenix
                            <li
                                key={guild.id}
                                className="flex items-center gap-4 rounded-[1.25rem] border border-dashed border-white/15 px-4 py-3.5"
                            >
                                <GuildIcon guild={guild} />
                                <span className="min-w-0 flex-1 font-bold break-words text-texte/80">{guild.name}</span>
                                <a
                                    href={`${INVITE_URL}?guild=${guild.id}`}
                                    className="ph-btn shrink-0 border border-flamme/45 px-4 py-2 text-sm text-flamme-claire hover:bg-flamme/10"
                                >
                                    Inviter Phenix
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

function GuildIcon({ guild }: { guild: PanelGuild }) {
    if (guild.iconUrl) {
        // Image du CDN Discord, déjà à la bonne taille : pas besoin de l'optimiseur de Next
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={guild.iconUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-2xl object-cover" />;
    }
    return (
        <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-or/25 to-flamme/10 font-extrabold text-or ring-1 ring-flamme/30"
        >
            {initials(guild.name)}
        </span>
    );
}
