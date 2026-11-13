/**
 * How many rows the notes sidebar's Recents shows (MIP-1435): `RECENT_NOTES_INITIAL` until the
 * "More" row is used, then everything it holds up to `RECENT_NOTES_MAX`. The API sends at most
 * that many readable notes (`RECENT_NOTES_CAP` in genos-api), so the cap here only keeps the
 * sidebar the same size against an older or a different server.
 */
export const RECENT_NOTES_INITIAL = 8;
export const RECENT_NOTES_MAX = 20;

export const visibleRecents = <T>(rows: readonly T[], expanded: boolean): T[] =>
    rows.slice(0, expanded ? RECENT_NOTES_MAX : RECENT_NOTES_INITIAL);

/** Rows behind the "More" row: zero when the first page already shows them all. */
export const hiddenRecentsCount = (total: number): number =>
    Math.max(0, Math.min(total, RECENT_NOTES_MAX) - RECENT_NOTES_INITIAL);
