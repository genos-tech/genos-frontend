/**
 * Which writes came from a connected AI app or an API key rather than from a
 * person typing in Genos (MIP-1376).
 *
 * The server stamps every task change with `metadata.via` (`TaskActivity`,
 * `_record` in task_signals.py). Kinds that matter here:
 *
 *   - `oauth`   a connected app (MCP over OAuth)        -> "via MCP"
 *   - `api_key` an API key (MCP or the public REST API;
 *               the row cannot tell which)              -> "via API key"
 *   - `app`     the web app itself (also an Undo click) -> NO chip. This is every
 *               normal edit; marking it would mark everything.
 *   - `agent`   the in-app Genos AI                     -> no chip (not MCP)
 *   - anything else, or nothing                         -> no chip
 *
 * Privacy (Ken, 2026-11-13): the NAME of a key or app belongs to its owner. A key
 * writes as its owner, so the row's actor is the owner: the name is read only
 * when the viewer IS that actor. Everyone else gets the kind and nothing more.
 * (The API still sends the name to every reader of the task; this is what keeps
 * it off the screen. See the follow-up on `_serialize_activity`.)
 */

import type { TaskActivityProps } from "../../../types/tasks";

export type ViaKind = "mcp" | "apiKey";

export type ViaSource = {
    kind: ViaKind;
    /** The key's or app's name. Present ONLY when the viewer is the owner. */
    name: string | null;
};

/** A registered app name is text a stranger chose: keep it short. */
const MAX_NAME = 60;

const asId = (value: unknown): string | null =>
    value === null || value === undefined || value === "" ? null : String(value);

/** Is the viewer the person this row is attributed to? An unknown actor is nobody. */
export const isOwnRow = (
    actorId: string | number | null | undefined,
    myselfId: string | number | null | undefined
): boolean => {
    const actor = asId(actorId);
    const me = asId(myselfId);
    return actor !== null && me !== null && actor === me;
};

const cleanName = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, MAX_NAME) : null;
};

/**
 * The chip a `metadata.via` value earns, or null when it earns none.
 * `ownRow` is whether the viewer made the change: it alone unlocks the name.
 */
export const viaSourceFromVia = (via: unknown, ownRow: boolean): ViaSource | null => {
    if (via === null || typeof via !== "object") return null;
    const v = via as { kind?: unknown; key_name?: unknown; client_name?: unknown };
    if (v.kind === "oauth") {
        return { kind: "mcp", name: ownRow ? cleanName(v.client_name) : null };
    }
    if (v.kind === "api_key") {
        return { kind: "apiKey", name: ownRow ? cleanName(v.key_name) : null };
    }
    return null;
};

type RowLike = Pick<TaskActivityProps, "metadata" | "actor">;

/** The chip for one history row, as the viewer may see it. */
export const viaSourceOfRow = (
    row: RowLike,
    myselfId: string | number | null | undefined
): ViaSource | null => viaSourceFromVia(row.metadata?.via, isOwnRow(row.actor?.userId, myselfId));

const COMMENT_WRITES = new Set(["comment_added", "comment_edited"]);

/**
 * For each comment the history knows of, how its LATEST write arrived.
 *
 * A comment's card has no `via` of its own: the server records it on the
 * `comment_added` / `comment_edited` rows (`metadata.commentId`). The newest of
 * those decides, so a comment an app wrote and the person then fixed by hand is
 * the person's now and carries no chip, while one the person wrote and an app
 * later rewrote does. A comment with no row in the loaded page (the feed is the
 * newest 100) is absent from the map: no chip, which is "unknown", not "typed".
 *
 * Absent from the map and `null` both mean "no chip".
 */
export const commentViaByCommentId = (
    activities: readonly TaskActivityProps[],
    myselfId: string | number | null | undefined
): Map<number, ViaSource | null> => {
    const newest = new Map<number, TaskActivityProps>();
    for (const row of activities) {
        if (!COMMENT_WRITES.has(row.actionType)) continue;
        const id = row.metadata?.commentId;
        // A number only: `Number(null)` is 0, which would pin a stray row to comment 0.
        if (typeof id !== "number" || !Number.isFinite(id)) continue;
        const seen = newest.get(id);
        // `activityId` only ever grows, so it orders rows even when the feed's
        // order is not what we assume.
        if (!seen || row.activityId > seen.activityId) newest.set(id, row);
    }
    const out = new Map<number, ViaSource | null>();
    for (const [id, row] of newest) out.set(id, viaSourceOfRow(row, myselfId));
    return out;
};
