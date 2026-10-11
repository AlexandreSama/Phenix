// src/app/page.tsx : page d'accueil publique. La liste des serveurs de l'utilisateur est sur /servers.
import Image from "next/image";
import { Check, DoorOpen, Gift, ShieldCheck, Swords, Ticket, TrendingUp } from "lucide-react";
import { ModulesPreview, RaidPreview, SettingsPreview } from "@/components/previews";
import { INVITE_URL, LOGIN_URL, SiteFooter, SiteHeader } from "@/components/site-chrome";
import logo from "@/assets/phenix-logo.webp";

const MODULES = [
    {
        name: "Modération",
        icon: ShieldCheck,
        text: "Bans, mutes et avertissements. Les sanctions temporaires sont levées toutes seules, et chaque action part dans votre salon de logs.",
    },
    {
        name: "Raids The Division 2",
        icon: Swords,
        text: "Raids et incursions avec inscriptions par rôle, liste d'attente et suppléants, puis un rappel 15 minutes avant le départ.",
    },
    {
        name: "Niveaux",
        icon: TrendingUp,
        text: "De l'expérience à chaque message, des rôles offerts aux paliers, et les salons de votre choix ignorés.",
    },
    {
        name: "Giveaways",
        icon: Gift,
        text: "Le tirage se fait tout seul à la fin, même si le bot a redémarré entre-temps.",
    },
    {
        name: "Tickets",
        icon: Ticket,
        text: "Un salon privé par demande, ouvert à votre équipe, et la conversation archivée à la fermeture.",
    },
    {
        name: "Accueil",
        icon: DoorOpen,
        text: "Messages de bienvenue et de départ, et rôles donnés automatiquement aux nouveaux membres.",
    },
];

const PANEL_POINTS = [
    { title: "Des listes, pas des ID.", text: "Salons et rôles se choisissent par leur nom." },
    { title: "Un interrupteur par module.", text: "Coupez ce dont votre serveur n'a pas besoin." },
    { title: "Des droits pour votre équipe.", text: "Administration, modération ou lecture seule." },
    { title: "Un historique des réglages.", text: "Chaque modification est tracée dans le journal du panel." },
];

const STEPS = [
    { title: "Ajoutez Phenix", text: "Invitez le bot sur votre serveur depuis Discord, en deux clics." },
    {
        title: "Connectez-vous au panel",
        text: "Avec votre compte Discord : vous y retrouvez les serveurs que vous gérez.",
    },
    {
        title: "Activez vos modules",
        text: "Choisissez les salons, réglez les options, enregistrez : le bot suit tout de suite.",
    },
];

const sectionTitle = "text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-balance";

export default function Home() {
    return (
        <div className="ph-page flex min-h-full flex-1 flex-col overflow-x-clip">
            <SiteHeader sections />

            <main className="flex-1">
                <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-14">
                    <div>
                        <h1 className="max-w-[13ch] text-[clamp(2.6rem,5.4vw,4.25rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-balance">
                            Phenix veille sur vos serveurs Discord
                        </h1>
                        <p className="mt-6 max-w-[32em] text-lg text-doux">
                            Modération, niveaux, raids The Division 2, giveaways et tickets, réglés depuis un panel web.
                            Plus besoin de retenir une seule commande.
                        </p>
                        <div className="mt-9 flex flex-wrap gap-3">
                            <a href={INVITE_URL} className="ph-btn ph-btn-primary px-6 py-3.5">
                                Ajouter Phenix à Discord
                            </a>
                            <a href={LOGIN_URL} className="ph-btn ph-btn-ghost px-6 py-3.5">
                                Ouvrir le panel
                            </a>
                        </div>
                    </div>

                    <div className="relative lg:pb-10">
                        <div className="ph-rise lg:mr-24">
                            <RaidPreview />
                        </div>
                        <div className="ph-rise-late mt-4 lg:absolute lg:-bottom-8 lg:right-0 lg:mt-0 lg:w-64">
                            <ModulesPreview />
                        </div>
                    </div>
                </section>

                <section id="modules" className="mx-auto w-full max-w-7xl scroll-mt-6 px-5 pb-20 pt-12 sm:px-8 lg:pb-24 lg:pt-16">
                    <h2 className={`max-w-[20ch] ${sectionTitle}`}>Tout ce qu&apos;un serveur de jeu attend de son bot</h2>
                    <p className="mt-4 max-w-[34em] text-lg text-doux">
                        Six modules, à activer et régler serveur par serveur.
                    </p>
                    <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {MODULES.map((module) => (
                            <li key={module.name} className="ph-glass p-6 sm:p-7">
                                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-or/25 to-flamme/10 ring-1 ring-flamme/30">
                                    <module.icon aria-hidden="true" className="size-6 text-or" />
                                </span>
                                <h3 className="mt-5 text-lg font-bold">{module.name}</h3>
                                <p className="mt-2 text-doux">{module.text}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    id="panel"
                    className="mx-auto grid w-full max-w-7xl scroll-mt-6 items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-24"
                >
                    <div>
                        <h2 className={sectionTitle}>Réglé depuis le panel, pas à coups de commandes</h2>
                        <ul className="mt-8 space-y-4">
                            {PANEL_POINTS.map((point) => (
                                <li key={point.title} className="flex gap-3">
                                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-flamme/15 text-flamme-claire ring-1 ring-flamme/35">
                                        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                                    </span>
                                    <span className="text-doux">
                                        <strong className="font-bold text-texte">{point.title}</strong> {point.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <SettingsPreview />
                </section>

                <section id="demarrer" className="mx-auto w-full max-w-7xl scroll-mt-6 px-5 py-20 sm:px-8 lg:py-24">
                    <h2 className={sectionTitle}>Prêt en trois étapes</h2>
                    <ol className="mt-12 grid gap-4 md:grid-cols-3">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="ph-glass p-6 sm:p-7">
                                <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-or to-flamme text-lg font-extrabold text-[#1d0c06]">
                                    {index + 1}
                                </span>
                                <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                                <p className="mt-2 text-doux">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="mx-auto w-full max-w-7xl px-5 pb-24 pt-4 sm:px-8">
                    <div className="ph-glass relative isolate overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-16">
                        {/* Lueur sous le bloc : la braise qui couve */}
                        <div
                            aria-hidden="true"
                            className="absolute -bottom-48 left-1/2 -z-10 h-80 w-[46rem] max-w-[140%] -translate-x-1/2 rounded-full bg-flamme/35 blur-3xl"
                        />
                        <Image src={logo} alt="PhenixMG" width={100} height={100} unoptimized className="ph-logo mx-auto" />
                        <h2 className={`mx-auto mt-6 max-w-[18ch] ${sectionTitle}`}>Votre serveur mérite son phénix</h2>
                        <p className="mx-auto mt-4 max-w-[30em] text-lg text-doux">
                            Ajoutez Phenix, connectez-vous avec Discord, et réglez tout depuis le panel.
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            <a href={INVITE_URL} className="ph-btn ph-btn-primary px-6 py-3.5">
                                Ajouter Phenix à Discord
                            </a>
                            <a href={LOGIN_URL} className="ph-btn ph-btn-ghost px-6 py-3.5">
                                Ouvrir le panel
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
}
