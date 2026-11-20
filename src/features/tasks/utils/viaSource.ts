/**
 * Which writes came from a connected AI app or an API key rather than from a
 * person typing in Genos (MIP-1376).
 *
 * The server stamps every task change with `metadata.via` (`TaskActivity`,
 * `_record` in task_signals.py). Kinds that matter here:
 *
 *   - `oauth`   a connected app (MCP over OAuth)        -> "via MCP", or the app's
 *               own small mark when `app` is "claude" / "chatgpt" (MIP-1568)
 *   - `api_key` an API key (MCP or the public REST API;
 *               the row cannot tell which)              -> "via API key"
 *   - `app`     the web app itself (also an Undo click) -> NO chip. This is every
 *               normal edit; marking it would mark everything.
 *   - `agent`   the in-app Genos AI                     -> no chip (not MCP)
 *   - anything else, or nothing                         -> no chip
 *
 * Privacy (Ken, 2026-11-13): the NAME of a key or app belongs to its owner. A key
 * writes as its owner, so the row's actor is the owner. The API enforces it (api
 * #758, MIP-1485): to everyone but the actor it reduces `via` to its kind
 * (`{ kind: "api_key" }`), and only the actor reads it whole. This file adds a
 * second lock on the activity rows (the name is read only when the viewer IS the
 * row's actor), so a reader never depends on the server alone. A comment's `via`
 * is the server's answer for this viewer already and carries no actor: see
 * `viaSourceOfComment`.
 */

import type { TaskActivityProps, TaskCommentProps } from "../../../types/tasks";

export type ViaKind = "mcp" | "apiKey";

/** The official apps whose small mark can stand in for the generic chip (MIP-1568). */
export type ViaApp = "claude" | "chatgpt";

export type ViaSource = {
    kind: ViaKind;
    /** The key's or app's name. Present ONLY when the viewer is the owner. */
    name: string | null;
    /**
     * Which official AI app made the change, when the server says so (a coarse family
     * the API derives from the registered client, for every viewer: `{ kind: "oauth",
     * app: "claude" }`). Never the name. `null` for an API key, for any other app, for
     * an older API and for any value this build does not know: the generic chip shows.
     */
    app: ViaApp | null;
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

/**
 * Only the two exact family strings count. Anything else (a stranger's spoof such as
 * "Claude " or "claude-evil", a different case, a number, an object) is `null`, so
 * what a viewer sees is always one of our two marks or today's generic chip.
 */
export const parseViaApp = (value: unknown): ViaApp | null =>
    value === "claude" || value === "chatgpt" ? value : null;

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
    const v = via as { kind?: unknown; app?: unknown; key_name?: unknown; client_name?: unknown };
    if (v.kind === "oauth") {
        return {
            kind: "mcp",
            name: ownRow ? cleanName(v.client_name) : null,
            app: parseViaApp(v.app),
        };
    }
    if (v.kind === "api_key") {
        return { kind: "apiKey", name: ownRow ? cleanName(v.key_name) : null, app: null };
    }
    return null;
};

type RowLike = Pick<TaskActivityProps, "metadata" | "actor">;

/** The chip for one history row, as the viewer may see it. */
export const viaSourceOfRow = (
    row: RowLike,
    myselfId: string | number | null | undefined
): ViaSource | null => viaSourceFromVia(row.metadata?.via, isOwnRow(row.actor?.userId, myselfId));

/**
 * The chip for one comment, from the `via` the comment list carries (api #760,
 * MIP-1486). The server picked the comment's LATEST write (a comment an app wrote
 * and the person then fixed by hand is the person's now: `{ kind: "app" }`, no
 * chip; one the person wrote and an app later rewrote carries the app) and already
 * reduced it for this viewer, so a name is present only for the owner and is shown
 * as given. No `via` (an older API, a comment just made here) or `null` (unknown,
 * not "typed") earns no chip.
 */
export const viaSourceOfComment = (comment: Pick<TaskCommentProps, "via">): ViaSource | null =>
    viaSourceFromVia(comment.via, true);

/**
 * The chip for one NOTE comment (MIP-1752), read from the Yjs comment's
 * `metadata.via` that `comment_on_note` / `reply_to_note_comment` stamp.
 *
 * That value is already the reduced one every reader of the note may see
 * (`{ kind, app? }`, never a name), because the whole Yjs doc goes to everyone who
 * opens the note. So this never unlocks a name: even a `client_name` that somehow
 * sat in the metadata is ignored (`ownRow` is always false), and an `app` other than
 * the two official families falls back to the generic chip. `kind: "app"` / `"agent"`
 * (stamped for completeness) and any other shape earn no chip.
 *
 * A comment someone edits in the editor loses its `via` (BlockNote's edit sends no
 * metadata), so a hand-edited MCP comment is the person's now, like a task comment.
 */
export const viaSourceOfNoteComment = (comment: { metadata?: unknown }): ViaSource | null => {
    const metadata = comment.metadata;
    if (metadata === null || typeof metadata !== "object") return null;
    return viaSourceFromVia((metadata as { via?: unknown }).via, false);
};

/**
 * The chip for one note version (MIP-1488). The version's actor is its `editor`,
 * and a key writes as its owner, so the name is read only when the viewer IS the
 * editor (the second lock; the API already reduces `via` for everyone else). A
 * version with no editor (an old row) has no owner, so it never unlocks a name.
 */
export const viaSourceOfNoteVersion = (
    version: { via?: unknown; editor?: { userId?: string | number | null } | null },
    myselfId: string | number | null | undefined
): ViaSource | null => viaSourceFromVia(version.via, isOwnRow(version.editor?.userId, myselfId));

/**
 * The chip for one to-do item (MIP-1488). A to-do is private to its owner (the API
 * sends nobody else the list), so every item the viewer reads is theirs and the
 * name, when the server sent one, is theirs to see.
 */
export const viaSourceOfTodoItem = (item: { via?: unknown }): ViaSource | null =>
    viaSourceFromVia(item.via, true);
