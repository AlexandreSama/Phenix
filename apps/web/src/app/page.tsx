import { Suspense } from "react";
import type { PanelGuild } from "@phenix/shared";
import { api, getMe } from "@/lib/api";
import Link from "next/link";

async function Account() {
    const me = await getMe();
    if (!me) {
        // Lien classique, pas fetch() : le navigateur doit suivre les redirections vers Discord
        return (
            <a href="/api/auth/login" className="inline-block rounded bg-indigo-600 px-4 py-2 text-white">
                Se connecter avec Discord
            </a>
        );
    }

    const guilds = await api<PanelGuild[]>("/me/guilds");
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <p>Connecté en tant que {me.globalName ?? me.username}</p>
                <form action="/api/auth/logout" method="post">
                    <button type="submit" className="text-sm underline">
                        Se déconnecter
                    </button>
                </form>
            </div>
            <ul className="space-y-1">
                {guilds.map((guild) => (
                    <li key={guild.id}>
                        {guild.botPresent ? (
                            <Link href={`/guilds/${guild.id}`} className="text-indigo-600 hover:underline">
                                {guild.name}
                            </Link>
                        ) : (
                            guild.name
                        )}{" "}
                        : {guild.botPresent ? guild.role : "Phenix n'est pas sur ce serveur"}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function Home() {
    return (
        <main className="mx-auto max-w-2xl space-y-6 p-8 w-full">
            <h1 className="text-2xl font-semibold">Phenix</h1>
            {/* Cache Components : la lecture des cookies doit être dans un Suspense */}
            <Suspense fallback={<p>Chargement…</p>}>
                <Account />
            </Suspense>
        </main>
    );
}