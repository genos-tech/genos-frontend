// Small pieces the structured approval previews share. The older previews
// each define their own copy of `MetaChip` / `asString`; the ones added with
// the to-do and milestone tools (MIP-877 to MIP-885) use these.

import { Chip } from "@mui/joy";

export const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

export const MetaChip = ({ label }: { label: string }) => (
    <Chip size="sm" sx={{ fontSize: "0.75rem", "--Chip-minHeight": "18px" }} variant="soft">
        {label}
    </Chip>
);

/**
 * A value as the card prints it. '', null and an empty list are the tools'
 * "clear this" sentinels, so they read as `cleared` and never as a blank.
 */
export const placeValue = (v: unknown, cleared: string): string => {
    if (v === "" || v === null || (Array.isArray(v) && v.length === 0)) return cleared;
    if (Array.isArray(v)) return v.map(String).join(", ");
    return String(v);
};

/**
 * `old → new` when the event carries a snapshot of the present value (the
 * backend adds it as `current.<field>`; null means "unset"), and just the
 * new value when it does not.
 */
export const diffValue = (proposed: unknown, current: unknown, cleared: string): string =>
    current === undefined
        ? placeValue(proposed, cleared)
        : `${placeValue(current, cleared)} → ${placeValue(proposed, cleared)}`;

/** `2026-11-06T09:00:00+09:00` -> `2026-11-06 09:00`: already the user's own time. */
export const shortTime = (iso: string): string => iso.slice(0, 16).replace("T", " ");
