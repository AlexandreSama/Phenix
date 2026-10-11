// apps/web/src/app/guilds/[guildId]/dashboard.tsx
// Tableau de bord d'un serveur : barre latérale, barre du haut, un panneau par module
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
    Check,
    ChevronDown,
    DoorOpen,
    Gift,
    Hash,
    House,
    LogOut,
    Menu,
    Server,
    Settings,
    ShieldCheck,
    Swords,
    TrendingUp,
    X,
    type LucideIcon,
} from "lucide-react";
import {
    CONFIG_CHANNEL_FIELDS,
    guildConfigPatchSchema,
    SUPPORTED_LANGUAGES,
    type GuildConfigPatch,
    type GuildConfigResponse,
    type GuildDiscordResources,
    type MeResponse,
    type PanelGuild,
    type PanelRole,
} from "@phenix/shared";
import emblem from "@/assets/phenix-embleme.png";
import { displayName, initials } from "@/lib/names";
import { saveGuildConfig } from "./actions";
import { ChannelSelect, Field, PlainSelect, RoleSelect, Stepper, Switch } from "./fields";

type Values = GuildConfigResponse;
type ConfigField = Exclude<keyof Values, "guildId">;
type ChannelField = keyof typeof CONFIG_CHANNEL_FIELDS;
type ModuleField = "enableWelcome" | "enableModeration" | "enableLevels" | "enableGiveaways" | "enableTd2";
type Errors = Partial<Record<ConfigField | "", string>>;
type Status = { kind: "success" | "error"; text: string } | null;
type GuildSummary = Pick<PanelGuild, "id" | "name" | "iconUrl">;

const FORM_ID = "reglages";

const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
    fr: "Français",
    "en-US": "English (US)",
};

const ROLE_LABELS: Record<PanelRole, string> = {
    ADMIN: "Administrateur",
    MODERATOR: "Modérateur",
    VIEWER: "Lecture seule",
};

/** Modules de la barre latérale ; panel : ancre du panneau de réglages, s'il en a un */
const MODULES: { field: ModuleField; label: string; icon: LucideIcon; panel?: string }[] = [
    { field: "enableWelcome", label: "Accueil", icon: DoorOpen, panel: "accueil" },
    { field: "enableModeration", label: "Modération", icon: ShieldCheck, panel: "moderation" },
    { field: "enableLevels", label: "Niveaux", icon: TrendingUp },
    { field: "enableGiveaways", label: "Giveaways", icon: Gift, panel: "giveaways" },
    { field: "enableTd2", label: "Raids The Division 2", icon: Swords, panel: "raids" },
];

/** Usage de chaque salon, pour l'aperçu */
const CHANNEL_USES: { field: ChannelField; label: string; module?: ModuleField }[] = [
    { field: "welcomeChannelId", label: "Bienvenue", module: "enableWelcome" },
    { field: "goodbyeChannelId", label: "Départs", module: "enableWelcome" },
    { field: "logsChannelId", label: "Logs", module: "enableModeration" },
    { field: "activityChannelId", label: "Activité" },
    { field: "giveawayChannelId", label: "Giveaways", module: "enableGiveaways" },
    { field: "raidChannelId", label: "Raids", module: "enableTd2" },
    { field: "incursionChannelId", label: "Incursions", module: "enableTd2" },
    { field: "raidVocalCategoryId", label: "Vocaux de raid", module: "enableTd2" },
    { field: "ticketCategoryId", label: "Tickets" },
];

/** Seuls les champs modifiés partent vers l'API */
function diff(saved: Values, current: Values): GuildConfigPatch {
    const patch: Record<string, unknown> = {};
    for (const field of Object.keys(current) as (keyof Values)[]) {
        if (field !== "guildId" && current[field] !== saved[field]) patch[field] = current[field];
    }
    return patch as GuildConfigPatch;
}

function toErrors(list: { path: string; message: string }[]): Errors {
    const errors: Errors = {};
    for (const { path, message } of list) errors[path as ConfigField | ""] ??= message;
    return errors;
}

export function Dashboard({
                              guild,
                              role,
                              me,
                              guilds,
                              initialConfig,
                              resources,
                          }: {
    guild: GuildSummary;
    role: PanelRole;
    me: MeResponse;
    /** Serveurs où Phenix est présent, pour changer de serveur */
    guilds: GuildSummary[];
    initialConfig: GuildConfigResponse;
    resources: GuildDiscordResources;
}) {
    const canEdit = role === "ADMIN";
    const [saved, setSaved] = useState(initialConfig);
    const [values, setValues] = useState(initialConfig);
    const [errors, setErrors] = useState<Errors>({});
    const [status, setStatus] = useState<Status>(null);
    const [pending, startTransition] = useTransition();
    const [menuOpen, setMenuOpen] = useState(false);

    const patch = diff(saved, values);
    const changes = Object.keys(patch).length;

    function set<F extends ConfigField>(field: F, value: Values[F]) {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
        });
        setStatus(null);
    }

    function discard() {
        setValues(saved);
        setErrors({});
        setStatus(null);
    }

    function save() {
        // Même schéma que l'API : les erreurs simples s'affichent sans aller-retour
        const checked = guildConfigPatchSchema.safeParse(patch);
        if (!checked.success) {
            setErrors(toErrors(checked.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))));
            return;
        }
        startTransition(async () => {
            const result = await saveGuildConfig(guild.id, checked.data);
            if (result.ok) {
                setSaved(result.config);
                setValues(result.config);
                setErrors({});
                setStatus({ kind: "success", text: "Réglages enregistrés" });
                setTimeout(() => setStatus((current) => (current?.kind === "success" ? null : current)), 4000);
            } else {
                setErrors(toErrors(result.errors));
                setStatus({ kind: "error", text: result.message });
            }
        });
    }

    const channel = (field: ChannelField, label: string) => (
        <Field label={label} error={errors[field]}>
            <ChannelSelect
                kind={CONFIG_CHANNEL_FIELDS[field]}
                value={values[field]}
                resources={resources}
                disabled={!canEdit}
                onChange={(value) => set(field, value)}
            />
        </Field>
    );

    const actions = { changes, pending, status, globalError: errors[""], onDiscard: discard };

    return (
        <div className="ph-page flex min-h-full flex-1">
            <Sidebar
                guild={guild}
                guilds={guilds}
                values={values}
                canEdit={canEdit}
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                onToggle={(field, checked) => set(field, checked)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar guild={guild} role={role} me={me} onMenu={() => setMenuOpen(true)} />

                <form
                    id={FORM_ID}
                    noValidate // les messages viennent du schéma partagé, pas des bulles du navigateur
                    className="mx-auto w-full max-w-[90rem] flex-1 px-5 pb-32 pt-8 sm:px-8"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save();
                    }}
                >
                    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
                        <div className="min-w-0 max-w-2xl">
                            <h1 className="text-[clamp(2rem,3.4vw,2.75rem)] font-extrabold leading-tight tracking-[-0.02em]">
                                Réglages du serveur
                            </h1>
                            <p className="mt-2 text-doux">
                                Choisissez où Phenix écrit et quels modules tournent sur {guild.name}.
                            </p>
                        </div>
                        {/* Sur téléphone, seul le rappel en bas d'écran porte les boutons */}
                        {canEdit && (
                            <div className="hidden flex-wrap items-center gap-3 sm:flex">
                                <SaveActions {...actions} />
                            </div>
                        )}
                    </div>

                    {!canEdit && (
                        <p className="mt-6 rounded-2xl bg-or/10 px-4 py-3 text-sm text-or ring-1 ring-or/30">
                            Lecture seule : seuls les administrateurs du serveur peuvent modifier les réglages.
                        </p>
                    )}

                    <div className="mt-8 gap-5 lg:columns-2 2xl:columns-3">
                        <Panel title="Général" description="Valable pour tous les modules.">
                            <Field label="Langue du bot" error={errors.language}>
                                <PlainSelect
                                    value={values.language ?? ""}
                                    disabled={!canEdit}
                                    options={[
                                        { value: "", label: "Par défaut" },
                                        ...SUPPORTED_LANGUAGES.map((language) => ({
                                            value: language,
                                            label: LANGUAGE_LABELS[language],
                                        })),
                                    ]}
                                    onChange={(value) => set("language", (value || null) as Values["language"])}
                                />
                            </Field>
                            {channel("activityChannelId", "Salon d'activité")}
                        </Panel>

                        <Panel id="accueil" title="Accueil" enabled={values.enableWelcome}>
                            {channel("welcomeChannelId", "Salon de bienvenue")}
                            {channel("goodbyeChannelId", "Salon des départs")}
                        </Panel>

                        <Preview values={values} resources={resources} />

                        <Panel id="moderation" title="Modération" enabled={values.enableModeration}>
                            {channel("logsChannelId", "Salon des logs")}
                        </Panel>

                        <Panel id="raids" title="Raids The Division 2" enabled={values.enableTd2}>
                            {channel("raidChannelId", "Salon des raids")}
                            {channel("incursionChannelId", "Salon des incursions")}
                            {channel("raidVocalCategoryId", "Catégorie des vocaux de raid")}
                            <Stepper
                                label="Avertissements avant la blacklist"
                                value={values.td2StrikeThreshold}
                                min={1}
                                max={10}
                                unit={(count) => (count > 1 ? "avertissements" : "avertissement")}
                                disabled={!canEdit}
                                error={errors.td2StrikeThreshold}
                                onChange={(value) => set("td2StrikeThreshold", value)}
                            />
                        </Panel>

                        <Panel id="giveaways" title="Giveaways" enabled={values.enableGiveaways}>
                            {channel("giveawayChannelId", "Salon des giveaways")}
                        </Panel>

                        <Panel id="tickets" title="Tickets">
                            {channel("ticketCategoryId", "Catégorie des tickets")}
                            <Field label="Rôle du staff" error={errors.ticketStaffRoleId}>
                                <RoleSelect
                                    value={values.ticketStaffRoleId}
                                    resources={resources}
                                    disabled={!canEdit}
                                    onChange={(value) => set("ticketStaffRoleId", value)}
                                />
                            </Field>
                        </Panel>
                    </div>
                </form>
            </div>

            {/* Rappel en bas d'écran, comme Discord, tant que des modifications attendent */}
            {canEdit && (changes > 0 || status !== null) && (
                <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-76">
                    <div className="ph-glass ph-glass-raised pointer-events-auto flex w-full max-w-2xl flex-wrap items-center justify-end gap-3 rounded-2xl px-4 py-3">
                        <SaveActions {...actions} compact />
                    </div>
                </div>
            )}
        </div>
    );
}

function SaveActions({
                         changes,
                         pending,
                         status,
                         globalError,
                         onDiscard,
                         compact = false,
                     }: {
    changes: number;
    pending: boolean;
    status: Status;
    globalError: string | undefined;
    onDiscard: () => void;
    compact?: boolean;
}) {
    let message: ReactNode;
    if (status?.kind === "success") {
        message = (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                {status.text}
            </span>
        );
    } else if (status?.kind === "error") message = <span className="text-red-300">{status.text}</span>;
    else if (globalError) message = <span className="text-red-300">{globalError}</span>;
    else if (changes > 0)
        message = (
            <span className="text-or">
                {changes} modification{changes > 1 ? "s" : ""} non enregistrée{changes > 1 ? "s" : ""}
            </span>
        );
    else message = <span className="text-discret">Aucune modification</span>;

    return (
        <>
            {/* Un seul role="status" sur la page : celui du rappel en bas d'écran */}
            <p role={compact ? "status" : undefined} className={`text-sm font-semibold ${compact ? "mr-auto" : ""}`}>
                {message}
            </p>
            <button
                type="button"
                className="ph-btn ph-btn-ghost px-5 py-2.5 disabled:opacity-40"
                disabled={changes === 0 || pending}
                onClick={onDiscard}
            >
                Annuler
            </button>
            <button
                type="submit"
                form={FORM_ID}
                className="ph-btn ph-btn-primary px-5 py-2.5 disabled:opacity-40 disabled:shadow-none"
                disabled={changes === 0 || pending}
            >
                {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
        </>
    );
}

function Panel({
                   id,
                   title,
                   description,
                   enabled,
                   children,
               }: {
    id?: string;
    title: string;
    description?: string;
    /** État du module ; absent pour les panneaux sans interrupteur */
    enabled?: boolean;
    children: ReactNode;
}) {
    return (
        <section id={id} className="ph-glass mb-5 break-inside-avoid scroll-mt-24 p-6">
            <div className="flex items-center gap-3">
                <h2 className="flex-1 text-xl font-bold">{title}</h2>
                {enabled !== undefined && (
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            enabled ? "bg-flamme/15 text-flamme-claire ring-1 ring-flamme/30" : "bg-white/[0.06] text-doux"
                        }`}
                    >
                        {enabled ? "Activé" : "Désactivé"}
                    </span>
                )}
            </div>
            {description && <p className="mt-1 text-sm text-doux">{description}</p>}
            <div className={`mt-5 space-y-3 transition-opacity ${enabled === false ? "opacity-55" : ""}`}>{children}</div>
        </section>
    );
}

/** Les salons utilisés par Phenix, rangés comme dans la liste des salons de Discord */
function Preview({ values, resources }: { values: Values; resources: GuildDiscordResources }) {
    const uses = new Map<string, { label: string; active: boolean }[]>();
    for (const use of CHANNEL_USES) {
        const id = values[use.field];
        if (!id) continue;
        uses.set(id, [...(uses.get(id) ?? []), { label: use.label, active: use.module ? values[use.module] : true }]);
    }

    const textChannels = resources.channels.filter((channel) => channel.kind === "text" && uses.has(channel.id));
    const groups = [
        { id: "", name: "Sans catégorie", channels: textChannels.filter((channel) => channel.parentId === null) },
        ...resources.channels
            .filter((channel) => channel.kind === "category")
            .map((category) => ({
                id: category.id,
                name: category.name,
                channels: textChannels.filter((channel) => channel.parentId === category.id),
            })),
    ].filter((group) => group.channels.length > 0 || uses.has(group.id));

    return (
        <Panel title="Aperçu" description="Les salons où Phenix écrit, rangés comme sur Discord.">
            {groups.length === 0 ? (
                <p className="text-sm text-doux">Aucun salon choisi pour l&apos;instant.</p>
            ) : (
                <div className="rounded-2xl bg-black/25 p-2 ring-1 ring-white/[0.06]">
                    {groups.map((group) => (
                        <div key={group.id || "sans-categorie"} className="py-1">
                            <p className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs font-bold text-doux">
                                <ChevronDown aria-hidden="true" className="size-3" />
                                {group.name}
                                <UseChips uses={uses.get(group.id)} />
                            </p>
                            <ul>
                                {group.channels.map((channel) => (
                                    <li key={channel.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5">
                                        <Hash aria-hidden="true" className="size-4 text-discret" />
                                        <span className="mr-auto font-semibold text-texte/90">{channel.name}</span>
                                        <UseChips uses={uses.get(channel.id)} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

function UseChips({ uses }: { uses: { label: string; active: boolean }[] | undefined }) {
    return uses?.map((use) => (
        <span
            key={use.label}
            title={use.active ? undefined : "Module désactivé"}
            className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${
                use.active ? "bg-flamme/15 text-flamme-claire ring-1 ring-flamme/30" : "bg-white/[0.06] text-discret line-through"
            }`}
        >
            {use.label}
        </span>
    ));
}

function Sidebar({
                     guild,
                     guilds,
                     values,
                     canEdit,
                     open,
                     onClose,
                     onToggle,
                 }: {
    guild: GuildSummary;
    guilds: GuildSummary[];
    values: Values;
    canEdit: boolean;
    open: boolean;
    onClose: () => void;
    onToggle: (field: ModuleField, checked: boolean) => void;
}) {
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const navItem = "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors";

    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Fermer le menu"
                    className="fixed inset-0 z-30 bg-black/60 lg:hidden"
                    onClick={onClose}
                />
            )}
            <aside
                data-open={open}
                className="fixed inset-y-0 left-0 z-40 flex w-76 -translate-x-full flex-col gap-6 overflow-y-auto border-r border-white/[0.07] bg-[#170c13] px-4 py-5 transition-transform data-[open=true]:translate-x-0 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 lg:bg-black/25"
            >
                <div className="flex items-center justify-between px-2">
                    <Link href="/" className="flex items-center gap-3 rounded-xl">
                        <Image src={emblem} alt="" width={46} height={36} unoptimized className="ph-logo" />
                        <span className="text-xl font-extrabold tracking-tight">Phenix</span>
                    </Link>
                    <button
                        type="button"
                        aria-label="Fermer le menu"
                        className="grid size-9 place-items-center rounded-full hover:bg-white/[0.08] lg:hidden"
                        onClick={onClose}
                    >
                        <X aria-hidden="true" className="size-5" />
                    </button>
                </div>

                {/* Changer de serveur */}
                <div>
                    <button
                        type="button"
                        aria-expanded={switcherOpen}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] p-2 pr-3 text-left ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.08]"
                        onClick={() => setSwitcherOpen((current) => !current)}
                    >
                        <GuildIcon guild={guild} />
                        <span className="min-w-0 flex-1 truncate font-bold">{guild.name}</span>
                        <ChevronDown
                            aria-hidden="true"
                            className={`size-4 text-discret transition-transform ${switcherOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                    {switcherOpen && (
                        <ul className="mt-2 space-y-0.5 rounded-2xl bg-white/[0.04] p-1.5 ring-1 ring-white/[0.06]">
                            {guilds.map((entry) => (
                                <li key={entry.id}>
                                    <Link
                                        href={`/guilds/${entry.id}`}
                                        aria-current={entry.id === guild.id ? "page" : undefined}
                                        className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.06] aria-[current=page]:bg-white/[0.08] aria-[current=page]:font-bold"
                                    >
                                        <GuildIcon guild={entry} small />
                                        <span className="truncate">{entry.name}</span>
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <Link
                                    href="/servers"
                                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-doux transition-colors hover:bg-white/[0.06] hover:text-texte"
                                >
                                    <Server aria-hidden="true" className="size-4" />
                                    Tous mes serveurs
                                </Link>
                            </li>
                        </ul>
                    )}
                </div>

                <nav aria-label="Navigation du panel">
                    <ul className="space-y-1">
                        <li>
                            <span
                                aria-current="page"
                                className={`${navItem} bg-gradient-to-r from-flamme to-flamme-claire font-bold text-[#1d0c06] shadow-[0_12px_28px_-14px_rgb(255_90_13/0.9)]`}
                            >
                                <Settings aria-hidden="true" className="size-5" />
                                Réglages du serveur
                            </span>
                        </li>
                        <li>
                            <Link href="/servers" className={`${navItem} text-doux hover:bg-white/[0.05] hover:text-texte`}>
                                <Server aria-hidden="true" className="size-5" />
                                Mes serveurs
                            </Link>
                        </li>
                        <li>
                            <Link href="/" className={`${navItem} text-doux hover:bg-white/[0.05] hover:text-texte`}>
                                <House aria-hidden="true" className="size-5" />
                                Page d&apos;accueil
                            </Link>
                        </li>
                    </ul>
                </nav>

                <div>
                    <p className="px-3 text-xs font-bold text-discret">Modules</p>
                    <ul className="mt-2 space-y-1">
                        {MODULES.map((module) => {
                            const label = (
                                <>
                                    <module.icon
                                        aria-hidden="true"
                                        className={`size-5 shrink-0 ${values[module.field] ? "text-or" : "text-discret"}`}
                                    />
                                    <span className="min-w-0 flex-1 truncate">{module.label}</span>
                                </>
                            );
                            return (
                                <li
                                    key={module.field}
                                    className="flex items-center gap-2 rounded-2xl pr-3 transition-colors hover:bg-white/[0.05]"
                                >
                                    {module.panel ? (
                                        <a href={`#${module.panel}`} className={`${navItem} min-w-0 flex-1`} onClick={onClose}>
                                            {label}
                                        </a>
                                    ) : (
                                        <span className={`${navItem} min-w-0 flex-1`}>{label}</span>
                                    )}
                                    <Switch
                                        label={`Module ${module.label}`}
                                        checked={values[module.field]}
                                        disabled={!canEdit}
                                        onChange={(checked) => onToggle(module.field, checked)}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Équivalent de la carte « Upgrade » de la maquette */}
                <a
                    href="/invite"
                    className="relative mt-auto block overflow-hidden rounded-3xl bg-gradient-to-br from-or to-flamme p-5 text-[#1d0c06] shadow-[0_18px_40px_-18px_rgb(255_90_13/0.9)] transition-[filter] hover:brightness-105"
                >
                    <Image
                        src={emblem}
                        alt=""
                        width={92}
                        height={72}
                        unoptimized
                        className="absolute -right-3 -top-2 rotate-12 opacity-90"
                    />
                    <span className="relative block max-w-[10rem] text-lg font-extrabold leading-tight">
                        Inviter Phenix sur un autre serveur
                    </span>
                    <span className="relative mt-1 block text-sm font-semibold opacity-80">En deux clics depuis Discord</span>
                </a>
            </aside>
        </>
    );
}

function TopBar({ guild, role, me, onMenu }: { guild: GuildSummary; role: PanelRole; me: MeResponse; onMenu: () => void }) {
    const [open, setOpen] = useState(false);
    const name = displayName(me);
    const menuItem =
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.9375rem] transition-colors hover:bg-white/[0.07]";

    return (
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-fond/75 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[90rem] items-center gap-3 px-5 py-3 sm:px-8">
                <button
                    type="button"
                    aria-label="Ouvrir le menu"
                    className="grid size-10 place-items-center rounded-full hover:bg-white/[0.08] lg:hidden"
                    onClick={onMenu}
                >
                    <Menu aria-hidden="true" className="size-5" />
                </button>
                <GuildIcon guild={guild} />
                <p className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-bold">{guild.name}</span>
                    <span className="block text-xs text-doux">{ROLE_LABELS[role]}</span>
                </p>

                <div
                    className="relative"
                    onKeyDown={(event) => {
                        if (event.key === "Escape") setOpen(false);
                    }}
                >
                    <button
                        type="button"
                        aria-expanded={open}
                        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/[0.07]"
                        onClick={() => setOpen((current) => !current)}
                    >
                        <Avatar me={me} />
                        <span className="hidden max-w-[10rem] truncate font-semibold sm:inline">{name}</span>
                        <ChevronDown
                            aria-hidden="true"
                            className={`size-4 text-discret transition-transform ${open ? "rotate-180" : ""}`}
                        />
                    </button>
                    {open && (
                        <>
                            {/* Clic en dehors du menu : il se referme */}
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-hidden="true"
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setOpen(false)}
                            />
                            <div className="ph-glass ph-glass-raised absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl p-1.5">
                                <Link href="/servers" className={menuItem}>
                                    <Server aria-hidden="true" className="size-4 text-doux" />
                                    Mes serveurs
                                </Link>
                                <Link href="/" className={menuItem}>
                                    <House aria-hidden="true" className="size-4 text-doux" />
                                    Page d&apos;accueil
                                </Link>
                                <form action="/api/auth/logout" method="post">
                                    <button type="submit" className={`${menuItem} text-red-300`}>
                                        <LogOut aria-hidden="true" className="size-4" />
                                        Se déconnecter
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

function GuildIcon({ guild, small = false }: { guild: GuildSummary; small?: boolean }) {
    const size = small ? "size-7 rounded-lg text-[0.6875rem]" : "size-10 rounded-xl text-sm";
    if (guild.iconUrl) {
        // Image du CDN Discord, déjà à la bonne taille : pas besoin de l'optimiseur de Next
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={guild.iconUrl} alt="" className={`${size} shrink-0 object-cover`} />;
    }
    return (
        <span
            aria-hidden="true"
            className={`${size} grid shrink-0 place-items-center bg-gradient-to-br from-or/25 to-flamme/10 font-extrabold text-or ring-1 ring-flamme/30`}
        >
            {initials(guild.name)}
        </span>
    );
}

function Avatar({ me }: { me: MeResponse }) {
    if (me.avatarUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={me.avatarUrl} alt="" width={32} height={32} className="size-8 rounded-full" />;
    }
    return (
        <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-or to-flamme text-xs font-extrabold text-[#1d0c06]"
        >
            {initials(displayName(me))}
        </span>
    );
}