// Aperçus décoratifs de la page d'accueil : un message de Phenix sur Discord, les modules, les réglages.
// Contenu fictif mais fidèle à ce que fait le bot (rôles DPS / heal / tank, 8 joueurs, rappel 15 min avant).
import Image from "next/image";
import { Check, ChevronDown, DoorOpen, Gift, Hash, Minus, Plus, ShieldCheck, Swords, TrendingUp } from "lucide-react";
import emblem from "@/assets/phenix-embleme.png";

function BotAvatar() {
    return (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3a1622] to-[#24101a] ring-1 ring-white/10">
            <Image src={emblem} alt="" width={30} height={24} unoptimized />
        </span>
    );
}

export function RaidPreview() {
    const roles = [
        { name: "Tank", filled: "2/2" },
        { name: "DPS", filled: "4/4" },
        { name: "Heal", filled: "1/2" },
    ];
    return (
        <figure className="ph-glass overflow-hidden" aria-label="Exemple de message de Phenix pour un raid">
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5 text-sm text-doux">
                <Hash aria-hidden="true" className="size-4" />
                <span className="font-semibold">raids-td2</span>
            </div>
            <div className="flex gap-3 p-5">
                <BotAvatar />
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold">Phenix</span>
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-flamme px-1.5 py-px text-[0.6875rem] font-extrabold text-[#1d0c06]">
                            BOT <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                        </span>
                        <span className="text-xs text-discret">Aujourd&apos;hui à 20:45</span>
                    </p>
                    <p className="mt-1 text-[0.9375rem] text-doux">
                        Départ dans 15 minutes : rendez-vous dans le salon vocal Raid #1.
                    </p>

                    <div className="mt-3 rounded-2xl border-l-4 border-flamme bg-white/[0.045] p-4">
                        <p className="text-xs font-bold text-flamme-claire">Raid semi-speed</p>
                        <p className="mt-1 text-lg font-extrabold leading-snug">Opération Cheval de fer</p>
                        <p className="text-sm text-doux">Ce soir à 21:00, 7 joueurs sur 8</p>
                        <dl className="mt-3 grid grid-cols-3 gap-2">
                            {roles.map((role) => (
                                <div key={role.name} className="ph-field px-3 py-2">
                                    <dt className="text-xs text-doux">{role.name}</dt>
                                    <dd className="font-bold">{role.filled}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mt-3 text-sm text-doux">Liste d&apos;attente : 2 joueurs</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2" aria-hidden="true">
                        {["Tank", "DPS", "Heal"].map((role) => (
                            <span
                                key={role}
                                className="rounded-full bg-flamme/15 px-3.5 py-1.5 text-xs font-bold text-flamme-claire ring-1 ring-flamme/35"
                            >
                                {role}
                            </span>
                        ))}
                        <span className="rounded-full bg-white/[0.07] px-3.5 py-1.5 text-xs font-bold text-doux ring-1 ring-white/10">
                            Suppléant
                        </span>
                    </div>
                </div>
            </div>
        </figure>
    );
}

export function ModulesPreview() {
    const modules = [
        { name: "Accueil", icon: DoorOpen, on: true },
        { name: "Modération", icon: ShieldCheck, on: true },
        { name: "Niveaux", icon: TrendingUp, on: false },
        { name: "Giveaways", icon: Gift, on: true },
        { name: "Raids The Division 2", icon: Swords, on: true },
    ];
    return (
        <figure className="ph-glass ph-glass-raised p-5" aria-label="Exemple de modules activés sur un serveur">
            <p className="flex items-center justify-between gap-3">
                <span className="font-bold">Modules</span>
                <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs text-doux">PhenixMG</span>
            </p>
            <ul className="mt-3 space-y-1">
                {modules.map((module) => (
                    <li key={module.name} className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm">
                        <module.icon aria-hidden="true" className={`size-4 ${module.on ? "text-or" : "text-discret"}`} />
                        <span className={`flex-1 ${module.on ? "" : "text-doux"}`}>{module.name}</span>
                        <span className="ph-switch" data-on={module.on} />
                        <span className="sr-only">{module.on ? "activé" : "désactivé"}</span>
                    </li>
                ))}
            </ul>
        </figure>
    );
}

function SelectField({ label, value, channel = true }: { label: string; value: string; channel?: boolean }) {
    return (
        <div className="ph-field px-4 py-3">
            <p className="text-xs text-doux">{label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-semibold">
                {channel && <Hash aria-hidden="true" className="size-4 text-discret" />}
                <span className="flex-1 truncate">{value}</span>
                <ChevronDown aria-hidden="true" className="size-4 text-discret" />
            </p>
        </div>
    );
}

export function SettingsPreview() {
    return (
        <figure className="ph-glass p-5 sm:p-7" aria-label="Exemple de la page de réglages d'un serveur dans le panel">
            <p className="text-xl font-extrabold">Réglages de PhenixMG</p>
            <p className="mt-1 text-sm text-doux">Les changements s&apos;appliquent dès l&apos;enregistrement.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SelectField label="Salon de bienvenue" value="bienvenue" />
                <SelectField label="Salon des logs" value="logs-modération" />
                <SelectField label="Salon des raids" value="raids-td2" />
                <SelectField label="Catégorie des vocaux de raid" value="RAIDS" channel={false} />
                <div className="ph-field flex items-center gap-3 px-4 py-3 sm:col-span-2">
                    <span className="flex-1">
                        <span className="block text-xs text-doux">Absences avant la mise à l&apos;écart d&apos;un joueur</span>
                        <span className="block font-semibold">3 absences</span>
                    </span>
                    <span aria-hidden="true" className="flex items-center gap-1">
                        <span className="grid size-8 place-items-center rounded-full bg-white/[0.07]">
                            <Minus className="size-4" />
                        </span>
                        <span className="grid size-8 place-items-center rounded-full bg-white/[0.07]">
                            <Plus className="size-4" />
                        </span>
                    </span>
                </div>
            </div>
            <div className="mt-5 flex justify-end gap-2" aria-hidden="true">
                <span className="ph-btn ph-btn-ghost px-4 py-2 text-sm">Annuler</span>
                <span className="ph-btn ph-btn-primary px-4 py-2 text-sm">Enregistrer</span>
            </div>
        </figure>
    );
}
