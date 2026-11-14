// Small pieces the structured approval previews share. The older previews
// each define their own copy of `MetaChip` / `asString`; the ones added with
// the to-do and milestone tools (MIP-877 to MIP-885) use these.

import { Box, Chip, Typography } from "@mui/joy";

import { g } from "../../../theme/tokens";

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

export interface LinkEntry {
    url: string;
    title: string;
}

/**
 * The `links` of a task call as `{url, title}` rows: a link set the model sent
 * (`[{url, title}]`, a bare URL is read as one) or the present links the card
 * is told of (`current.links`). Anything that is not a link is left out, and a
 * link with no title is shown by its URL.
 */
export const linkEntries = (v: unknown): LinkEntry[] => {
    if (!Array.isArray(v)) return [];
    const out: LinkEntry[] = [];
    for (const item of v) {
        const row = typeof item === "string" ? { url: item } : item;
        if (!row || typeof row !== "object") continue;
        const { url, title } = row as { url?: unknown; title?: unknown };
        if (typeof url !== "string" || !url) continue;
        out.push({ url, title: typeof title === "string" && title ? title : url });
    }
    return out;
};

/**
 * A link set as the card prints it: one line per link, title then URL, as TEXT.
 * Never an anchor: the card shows the proposal before the server has judged the
 * URL's scheme, and a `javascript:` href runs in the app's origin when clicked.
 */
export const LinkLines = ({ links, label }: { links: LinkEntry[]; label: string }) => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        <Typography level="body-xs" sx={{ color: g.text.secondary, fontWeight: 600 }}>
            {label}
        </Typography>
        {links.map((link, i) => (
            <Typography
                key={`${i}-${link.url}`}
                level="body-xs"
                sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
            >
                {link.title === link.url ? link.url : `${link.title} · ${link.url}`}
            </Typography>
        ))}
    </Box>
);
