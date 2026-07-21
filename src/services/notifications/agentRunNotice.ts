// Completion notice for a *backgrounded* agent run.
//
// An agent ask deliberately survives its surface being dismissed — the
// Spotlight overlay (`useSpotlight`) and the thread / note Ask modals
// (`useThreadAsk` / `useNoteAsk`) all leave an in-flight stream running on
// close so the user can come back to the answer. Until now nothing told
// them the answer had landed; this module is that missing half.
//
// Delivery is the standard two-channel split every other notification
// uses, and the split is handled for us by `NotificationManager.notify`:
//   * tab visible   -> in-app toast (the user is in the app, just on a
//                      different screen)
//   * tab hidden    -> `new Notification()` here, UNLESS Web Push is live
//                      for this browser, in which case the service worker
//                      owns the OS card and the page suppresses its own.
//
// That last branch is why `agent_run_done` must stay listed in the
// manager's `PUSH_COVERED_CATEGORIES` in lockstep with the server firing
// the push (genos-api `agent_views._push_run_complete`) — listed but not
// pushed means a hidden tab gets nothing at all; pushed but not listed
// means the user gets two cards for one answer.

import { fmt, getMessages } from "../../i18n";
import type { NotificationManager } from "./notificationManager";
import type { NotificationDispatch } from "./types";

/** Which Ask surface produced the run. Only used to label the notice. */
export type AgentRunSurface = "spotlight" | "thread" | "note";

export interface AgentRunNotice {
    surface: AgentRunSurface;
    /** The user's question, shown as the notice body. */
    askedQuery: string;
    /** Backend run id when the stream reported one. Preferred for the
     *  dedupe key; `turnId` is the fallback for runs that ended before a
     *  `done` event carried one (e.g. a network error mid-stream). */
    runId?: string | null;
    /** Client-side turn counter — unique per surface within a session. */
    turnId: number;
    /** Non-null when the run ended in failure; switches the title. */
    error?: string | null;
    /** Invoked when the user clicks the toast / OS notification. Should
     *  reopen the surface the run belongs to. */
    onOpen?: () => void;
}

/** Notification bodies are a glance, not a transcript. */
const QUERY_PREVIEW_MAX = 120;

const truncate = (text: string): string => {
    const trimmed = (text || "").trim();
    if (trimmed.length <= QUERY_PREVIEW_MAX) return trimmed;
    return `${trimmed.slice(0, QUERY_PREVIEW_MAX - 1).trimEnd()}…`;
};

const surfaceLabel = (surface: AgentRunSurface): string => {
    const t = getMessages().services.notifications.agentRun;
    switch (surface) {
        case "thread":
            return t.surfaceThread;
        case "note":
            return t.surfaceNote;
        default:
            return t.surfaceSpotlight;
    }
};

/**
 * Fire the "your backgrounded answer is ready" notice.
 *
 * Callers are responsible for the *policy* decision — only call this when
 * the run's surface was actually closed, otherwise the user gets a toast
 * for an answer they just watched stream in. (The manager's active-surface
 * check can't help here: an agent run has no chat/thread source to match
 * against.)
 *
 * Returns the manager's dispatch verdict so tests and callers can assert
 * on it; `"ignored-disabled"` when the user has turned the category off is
 * a perfectly normal outcome, not an error.
 */
export const notifyAgentRunComplete = (
    manager: NotificationManager | null | undefined,
    notice: AgentRunNotice
): NotificationDispatch | null => {
    if (!manager) return null;
    const t = getMessages().services.notifications.agentRun;
    const query = truncate(notice.askedQuery);
    return manager.notify({
        // Stable per run so a `done` arriving after an `error` (or a
        // double-invoked effect) collapses into one card.
        id: `agent-run:${notice.surface}:${notice.runId || notice.turnId}`,
        category: "agent_run_done",
        title: `${notice.error ? t.failedTitle : t.doneTitle} • ${surfaceLabel(notice.surface)}`,
        body: query ? fmt(t.body, { query }) : t.bodyNoQuery,
        // NB: `senderId` is deliberately unset. The manager drops any
        // intent whose sender is the current user, and the person who
        // asked the question *is* the recipient — stamping it would
        // suppress every one of these notices as "self".
        onOpen: notice.onOpen,
    });
};
