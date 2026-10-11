// En-tête et pied de page des pages publiques (accueil, liste des serveurs)
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import type { MeResponse } from "@phenix/shared";
import { displayName, getViewer, initials } from "@/lib/viewer";
import emblem from "@/assets/phenix-embleme.png";
import logo from "@/assets/phenix-logo.webp";

/** Après la connexion Discord, on arrive directement sur la liste des serveurs */
export const LOGIN_URL = "/api/auth/login?returnTo=/servers";
export const INVITE_URL = "/invite";

export function SiteHeader({ sections = false }: { sections?: boolean }) {
    return (
        <header className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3 rounded-xl">
                <Image src={emblem} alt="" width={46} height={36} unoptimized className="ph-logo" />
                <span className="text-xl font-extrabold tracking-tight">Phenix</span>
            </Link>
            {sections && (
                <nav aria-label="Sections de la page" className="ml-8 hidden items-center gap-8 text-[0.9375rem] text-doux md:flex">
                    <a href="#modules" className="transition-colors hover:text-texte">
                        Modules
                    </a>
                    <a href="#panel" className="transition-colors hover:text-texte">
                        Le panel
                    </a>
                    <a href="#demarrer" className="transition-colors hover:text-texte">
                        Démarrer
                    </a>
                </nav>
            )}
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
                {/* Cache Components : la lecture des cookies doit être dans un Suspense */}
                <Suspense fallback={null}>
                    <HeaderAccount />
                </Suspense>
            </div>
        </header>
    );
}

async function HeaderAccount() {
    // API injoignable : l'en-tête se comporte comme pour un visiteur, la page d'accueil reste en ligne
    const me = await getViewer().catch(() => null);
    if (!me) {
        // Liens classiques, pas fetch() : le navigateur doit suivre les redirections vers Discord
        return (
            <>
                <a href={LOGIN_URL} className="ph-btn ph-btn-ghost px-4 py-2 text-[0.9375rem]">
                    Se connecter
                </a>
                <a href={INVITE_URL} className="ph-btn ph-btn-primary hidden px-4 py-2 text-[0.9375rem] sm:inline-flex">
                    Ajouter à Discord
                </a>
            </>
        );
    }

    return (
        <>
            <Link href="/servers" className="ph-btn ph-btn-ghost py-1.5 pl-1.5 pr-4 text-[0.9375rem]">
                <Avatar me={me} />
                Mes serveurs
            </Link>
            <form action="/api/auth/logout" method="post">
                <button
                    type="submit"
                    aria-label="Se déconnecter"
                    className="ph-btn px-3 py-2 text-[0.9375rem] text-doux hover:text-texte"
                >
                    <LogOut aria-hidden="true" className="size-4 sm:hidden" />
                    <span className="hidden sm:inline">Se déconnecter</span>
                </button>
            </form>
        </>
    );
}

function Avatar({ me }: { me: MeResponse }) {
    if (me.avatarUrl) {
        // Image du CDN Discord, déjà à la bonne taille : pas besoin de l'optimiseur de Next
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={me.avatarUrl} alt="" width={28} height={28} className="size-7 rounded-full" />;
    }
    return (
        <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-or to-flamme text-xs font-extrabold text-[#1d0c06]"
        >
            {initials(displayName(me))}
        </span>
    );
}

export function SiteFooter() {
    return (
        <footer className="border-t border-white/[0.07]">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-8 text-[0.9375rem] text-doux sm:px-8">
                <span className="flex items-center gap-3">
                    <Image src={logo} alt="PhenixMG" width={44} height={44} unoptimized />
                    <span>Phenix, par PhenixMG</span>
                </span>
                <nav aria-label="Liens du pied de page" className="flex gap-6 sm:ml-auto">
                    <a href={INVITE_URL} className="transition-colors hover:text-texte">
                        Ajouter à Discord
                    </a>
                    <Link href="/servers" className="transition-colors hover:text-texte">
                        Mes serveurs
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
