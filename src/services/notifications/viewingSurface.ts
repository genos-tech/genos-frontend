/**
 * The one conversation this tab currently has on screen, as a token the
 * backend understands.
 *
 * Sent with the presence heartbeat so `genos-api` can skip writing a
 * sidebar *activity* row for someone who is demonstrably already reading
 * the message it would announce — two people chatting in an open DM don't
 * need a feed entry per message about the conversation they are having.
 * See `origin/services/presence.py` (`mark_viewing`) and
 * `origin/services/v3_activity.py`, which mints the same three strings
 * from the message being fanned out.
 *
 * Derived from the SAME `ActiveSurface` that already suppresses in-app
 * toasts, deliberately: the server-side rule and the client-side rule are
 * then two readings of one value and can't disagree about what "the user
 * is looking at this" means. `App.tsx` owns that value, including the
 * route gate that stops a keep-alive Home from claiming a chat the user
 * navigated away from.
 *
 * Drift is safe in one direction only. A token the backend doesn't
 * recognise (or an id in the wrong space — a legacy integer chat id where
 * the server has the v3 channel UUID) simply matches nothing, so the
 * activity row gets written: the pre-existing behavior, never a silently
 * dropped notification.
 */

import type { ActiveSurface } from "./types";

/**
 * `""` when the user isn't in a conversation at all (inbox, settings, a
 * task list) — the heartbeat sends that verbatim to retract whatever this
 * device claimed before.
 *
 * Precedence matters where surfaces nest: an open thread pane is what the
 * reader is actually reading, so it wins over the channel behind it. This
 * mirrors `matchesActiveSurface`, which checks the thread first for the
 * same reason.
 */
export const viewingSurfaceToken = (active: ActiveSurface | null | undefined): string => {
    if (!active) return "";
    if (active.threadId !== undefined && active.threadId !== null) {
        return `thread:${active.threadId}`;
    }
    if (active.taskId !== undefined && active.taskId !== null) {
        return `task:${active.taskId}`;
    }
    if (active.chatId !== undefined && active.chatId !== null && active.chatId !== "") {
        return `channel:${active.chatId}`;
    }
    return "";
};
