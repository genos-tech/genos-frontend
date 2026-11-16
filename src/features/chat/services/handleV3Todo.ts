/**
 * Lands a live `todo.changed` socket event (MIP-1626).
 *
 * A to-do written over MCP, by the in-app agent or by another client was saved on the server and
 * announced to nobody, so the To-do page showed it only after a reload. genos-api now tells
 * genos-sockets after the write commits, and sockets sends `todo.changed` to the OWNER's `/v3` user
 * room: every tab they have open hears it, nobody else does. The payload is facts only,
 * `{teamId}`; no to-do text travels, so the page answers by re-reading its own list with its own
 * token (`useTodoGroups`).
 *
 * This fires from the socket router, which has no React context, so it lands as a `window` event,
 * the way `handleV3Activity` does for `activity.created`.
 */

/** Dispatched on `window` for every `todo.changed` (and after a socket reconnect, since the server
 *  does not buffer events missed while the device was away). `detail.teamId` is the team the
 *  change was in, or undefined when it is not known: the listener then re-reads regardless. */
export const V3_TODO_CHANGED_EVENT = "v3:todo:changed";

export type TodoChangedDetail = { teamId?: string };

export function handleV3TodoChanged(payload: unknown): void {
    const teamId =
        payload !== null && typeof payload === "object"
            ? (payload as { teamId?: unknown }).teamId
            : undefined;
    const detail: TodoChangedDetail = typeof teamId === "string" ? { teamId } : {};
    window.dispatchEvent(new CustomEvent<TodoChangedDetail>(V3_TODO_CHANGED_EVENT, { detail }));
}
