// apps/web/src/app/guilds/[guildId]/fields.tsx
// Champs du tableau de bord : listes de salons et de rôles, compteur, interrupteur
"use client";

import type { ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import type { GuildDiscordResources } from "@phenix/shared";

/** Boîte arrondie avec le libellé au-dessus de la valeur, comme dans la maquette */
export function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
    return (
        <div>
            <label className="ph-field relative block px-4 py-3 focus-within:ring-2 focus-within:ring-or/70">
                <span className="block text-xs text-doux">{label}</span>
                {children}
            </label>
            {error && <p className="mt-1.5 px-1 text-sm text-red-300">{error}</p>}
        </div>
    );
}

const SELECT =
    "mt-0.5 w-full cursor-pointer appearance-none truncate bg-transparent pr-7 font-semibold text-texte outline-none disabled:cursor-not-allowed disabled:text-doux";

function Chevron() {
    return <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-4 size-4 text-discret" />;
}

function missing(id: string | null, list: { id: string }[]): boolean {
    return id !== null && !list.some((item) => item.id === id);
}

export function PlainSelect({
                                value,
                                options,
                                disabled,
                                onChange,
                            }: {
    value: string;
    options: { value: string; label: string }[];
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <>
            <select className={SELECT} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <Chevron />
        </>
    );
}

/** Salons du bon type, regroupés par catégorie comme dans Discord */
export function ChannelSelect({
                                  kind,
                                  value,
                                  resources,
                                  disabled,
                                  onChange,
                              }: {
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
        <>
            <select
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
            <Chevron />
        </>
    );
}

export function RoleSelect({
                               value,
                               resources,
                               disabled,
                               onChange,
                           }: {
    value: string | null;
    resources: GuildDiscordResources;
    disabled: boolean;
    onChange: (value: string | null) => void;
}) {
    return (
        <>
            <select
                className={SELECT}
                value={value ?? ""}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value || null)}
            >
                <option value="">Aucun</option>
                {missing(value, resources.roles) && <option value={value ?? ""}>Rôle introuvable ({value})</option>}
                {resources.roles
                    .filter((role) => !role.managed) // rôles de bots : impossibles à attribuer
                    .map((role) => (
                        <option key={role.id} value={role.id}>
                            @{role.name}
                        </option>
                    ))}
            </select>
            <Chevron />
        </>
    );
}

/** Nombre entier entre min et max, réglé avec deux boutons */
export function Stepper({
                            label,
                            value,
                            min,
                            max,
                            unit,
                            disabled,
                            error,
                            onChange,
                        }: {
    label: string;
    value: number;
    min: number;
    max: number;
    unit: (value: number) => string;
    disabled: boolean;
    error?: string | undefined;
    onChange: (value: number) => void;
}) {
    const button =
        "grid size-8 place-items-center rounded-full bg-white/[0.07] transition-colors hover:bg-white/[0.12] disabled:opacity-40";
    return (
        <div>
            <div role="group" aria-label={label} className="ph-field flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                    <span className="block text-xs text-doux">{label}</span>
                    <output aria-live="polite" className="block font-semibold">
                        {value} {unit(value)}
                    </output>
                </span>
                <button
                    type="button"
                    aria-label="Diminuer"
                    className={button}
                    disabled={disabled || value <= min}
                    onClick={() => onChange(Math.max(min, value - 1))}
                >
                    <Minus aria-hidden="true" className="size-4" />
                </button>
                <button
                    type="button"
                    aria-label="Augmenter"
                    className={button}
                    disabled={disabled || value >= max}
                    onClick={() => onChange(Math.min(max, value + 1))}
                >
                    <Plus aria-hidden="true" className="size-4" />
                </button>
            </div>
            {error && <p className="mt-1.5 px-1 text-sm text-red-300">{error}</p>}
        </div>
    );
}

export function Switch({
                           label,
                           checked,
                           disabled,
                           onChange,
                       }: {
    label: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            data-on={checked}
            disabled={disabled}
            className="ph-switch"
            onClick={() => onChange(!checked)}
        />
    );
}