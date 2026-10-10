// apps/web/src/app/guilds/[guildId]/config-form.tsx
"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
    CONFIG_CHANNEL_FIELDS,
    guildConfigPatchSchema,
    SUPPORTED_LANGUAGES,
    type GuildConfigPatch,
    type GuildConfigResponse,
    type GuildDiscordResources,
} from "@phenix/shared";
import { saveGuildConfig } from "./actions";

type Values = GuildConfigResponse;
type Field = Exclude<keyof Values, "guildId">;
type ChannelField = keyof typeof CONFIG_CHANNEL_FIELDS;
type Errors = Partial<Record<Field | "", string>>;

const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
    fr: "Français",
    "en-US": "English (US)",
};

const MODULES: { field: Field; label: string; hint: string }[] = [
    { field: "enableWelcome", label: "Bienvenue", hint: "Messages d'arrivée et de départ" },
    { field: "enableModeration", label: "Modération", hint: "Bans, mutes, avertissements" },
    { field: "enableLevels", label: "Niveaux", hint: "XP gagnée en discutant" },
    { field: "enableGiveaways", label: "Giveaways", hint: "Tirages au sort" },
    { field: "enableTd2", label: "The Division 2", hint: "Raids et incursions" },
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
    for (const { path, message } of list) errors[path as Field | ""] ??= message;
    return errors;
}

export function ConfigForm({
                               guildId,
                               guildName,
                               canEdit,
                               initialConfig,
                               resources,
                           }: {
    guildId: string;
    guildName: string;
    canEdit: boolean;
    initialConfig: GuildConfigResponse;
    resources: GuildDiscordResources;
}) {
    const [saved, setSaved] = useState(initialConfig);
    const [values, setValues] = useState(saved);
    const [errors, setErrors] = useState<Errors>({});
    const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);
    const [pending, startTransition] = useTransition();

    const patch = diff(saved, values);
    const changes = Object.keys(patch).length;

    function set<F extends Field>(field: F, value: Values[F]) {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
        });
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
            const result = await saveGuildConfig(guildId, checked.data);
            if (result.ok) {
                setSaved(result.config);
                setValues(result.config);
                setErrors({});
                setStatus({ kind: "success", text: "Configuration enregistrée" });
            } else {
                setErrors(toErrors(result.errors));
                setStatus({ kind: "error", text: result.message });
            }
        });
    }

    const channelSelect = (field: ChannelField, label: string) => (
        <Row label={label} error={errors[field]}>
            <ChannelSelect
                id={field}
                kind={CONFIG_CHANNEL_FIELDS[field]}
                value={values[field]}
                resources={resources}
                disabled={!canEdit}
                onChange={(value) => set(field, value)}
            />
        </Row>
    );

    return (
        <form
            noValidate // les messages viennent du schéma partagé, pas des bulles du navigateur
            className="space-y-6 pb-24"
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
        >
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{guildName}</h1>
                {!canEdit && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Lecture seule : seuls les administrateurs du serveur peuvent modifier la configuration.
                    </p>
                )}
            </header>

            <Section title="Modules">
                <div className="grid gap-3 sm:grid-cols-2">
                    {MODULES.map(({ field, label, hint }) => (
                        <label key={field} className="flex items-start gap-3 rounded-md border border-zinc-200 p-3">
                            <input
                                type="checkbox"
                                role="switch"
                                name={field}
                                className="mt-1 size-4 accent-indigo-600"
                                checked={values[field] as boolean}
                                disabled={!canEdit}
                                onChange={(event) => set(field, event.target.checked)}
                            />
                            <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-zinc-500">{hint}</span>
              </span>
                        </label>
                    ))}
                </div>
            </Section>

            <Section title="Général">
                <Row label="Langue du bot" error={errors.language}>
                    <select
                        id="language"
                        className={SELECT}
                        value={values.language ?? ""}
                        disabled={!canEdit}
                        onChange={(event) => set("language", (event.target.value || null) as Values["language"])}
                    >
                        <option value="">Par défaut</option>
                        {SUPPORTED_LANGUAGES.map((language) => (
                            <option key={language} value={language}>
                                {LANGUAGE_LABELS[language]}
                            </option>
                        ))}
                    </select>
                </Row>
            </Section>

            <Section title="Salons">
                {channelSelect("welcomeChannelId", "Bienvenue")}
                {channelSelect("goodbyeChannelId", "Départs")}
                {channelSelect("logsChannelId", "Logs de modération")}
                {channelSelect("activityChannelId", "Activité")}
                {channelSelect("giveawayChannelId", "Giveaways")}
            </Section>

            <Section title="Tickets">
                {channelSelect("ticketCategoryId", "Catégorie des tickets")}
                <Row label="Rôle du staff" error={errors.ticketStaffRoleId}>
                    <select
                        id="ticketStaffRoleId"
                        className={SELECT}
                        value={values.ticketStaffRoleId ?? ""}
                        disabled={!canEdit}
                        onChange={(event) => set("ticketStaffRoleId", event.target.value || null)}
                    >
                        <option value="">Aucun</option>
                        {missing(values.ticketStaffRoleId, resources.roles) && (
                            <option value={values.ticketStaffRoleId ?? ""}>Rôle introuvable ({values.ticketStaffRoleId})</option>
                        )}
                        {resources.roles
                            .filter((role) => !role.managed) // rôles de bots : impossibles à attribuer
                            .map((role) => (
                                <option key={role.id} value={role.id}>
                                    @{role.name}
                                </option>
                            ))}
                    </select>
                </Row>
            </Section>

            <Section title="The Division 2">
                {channelSelect("raidChannelId", "Salon des raids")}
                {channelSelect("incursionChannelId", "Salon des incursions")}
                {channelSelect("raidVocalCategoryId", "Catégorie vocale des raids")}
                <Row label="Avertissements avant blacklist" error={errors.td2StrikeThreshold}>
                    <input
                        id="td2StrikeThreshold"
                        type="number"
                        min={1}
                        max={10}
                        className={`${FIELD} w-24`}
                        value={Number.isNaN(values.td2StrikeThreshold) ? "" : values.td2StrikeThreshold}
                        disabled={!canEdit}
                        onChange={(event) => set("td2StrikeThreshold", event.target.valueAsNumber)}
                    />
                </Row>
            </Section>

            {canEdit && (
                <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
                        <p role="status" className="flex-1 text-sm">
                            {status ? (
                                <span className={status.kind === "success" ? "text-emerald-700" : "text-red-700"}>{status.text}</span>
                            ) : errors[""] ? (
                                <span className="text-red-700">{errors[""]}</span>
                            ) : changes > 0 ? (
                                `${changes} modification${changes > 1 ? "s" : ""} non enregistrée${changes > 1 ? "s" : ""}`
                            ) : (
                                <span className="text-zinc-500">Aucune modification</span>
                            )}
                        </p>
                        <button
                            type="button"
                            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
                            disabled={changes === 0 || pending}
                            onClick={() => {
                                setValues(saved);
                                setErrors({});
                                setStatus(null);
                            }}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                            disabled={changes === 0 || pending}
                        >
                            {pending ? "Enregistrement…" : "Enregistrer"}
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}

const FIELD = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500";
const SELECT = `${FIELD} w-full sm:max-w-xs`;

function missing(id: string | null, list: { id: string }[]): boolean {
    return id !== null && !list.some((item) => item.id === id);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <fieldset className="space-y-4 rounded-lg border border-zinc-200 p-5">
            <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</legend>
            {children}
        </fieldset>
    );
}

function Row({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-center">
            <span className="text-sm font-medium">{label}</span>
            <div>
                {children}
                {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
            </div>
        </div>
    );
}

/** Liste des salons du bon type, regroupés par catégorie comme dans Discord */
function ChannelSelect({
                           id,
                           kind,
                           value,
                           resources,
                           disabled,
                           onChange,
                       }: {
    id: string;
    kind: "text" | "category";
    value: string | null;
    resources: GuildDiscordResources;
    disabled: boolean;
    onChange: (value: string | null) => void;
}) {
    const categories = resources.channels.filter((channel) => channel.kind === "category");
    const choices = resources.channels.filter((channel) => channel.kind === kind);
    const groups =
        kind === "category"
            ? [{ label: "Catégories", channels: choices }]
            : [
                { label: "Sans catégorie", channels: choices.filter((channel) => channel.parentId === null) },
                ...categories.map((category) => ({
                    label: category.name,
                    channels: choices.filter((channel) => channel.parentId === category.id),
                })),
            ].filter((group) => group.channels.length > 0);

    return (
        <select
            id={id}
            className={SELECT}
            value={value ?? ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value || null)}
        >
            <option value="">Aucun</option>
            {missing(value, resources.channels) && <option value={value ?? ""}>Salon introuvable ({value})</option>}
            {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                    {group.channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                            {kind === "text" ? `# ${channel.name}` : channel.name}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}