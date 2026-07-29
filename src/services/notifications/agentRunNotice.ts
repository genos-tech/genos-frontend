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
// `agent_run_done` is deliberately NOT in the manager's
// `PUSH_COVERED_CATEGORIES`: the server push (genos-api
// `_push_run_complete`) applies a duration floor and a presence gate that
// this code can't observe, so deferring to it would leave a hidden tab
// with nothing whenever either gate bites. Instead the page always raises
// its own card, and the intent `id` is aligned with the server's push
// `tag` (`agent_run_done:<run_id>`) so a push that also arrives REPLACES
// the page's card instead of stacking a second one. Keep the two formats
// identical — that shared string is the entire de-duplication mechanism.

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

// Card / toast icon. Every other notification shows the person who
// caused it, but an agent run has no human actor — the Genos mark is the
// meaningful identity here.
//
// Deliberately the PUBLIC path rather than a bundled `assets/` import:
// the service worker hardcodes this same URL as its push-card fallback
// (`public/sw.js`), and a run can be announced by either side. A hashed
// bundle URL would render the two paths differently for one feature.
// Keep in sync with `sw.js` if the file is ever renamed.
// Opaque icon rather than the transparent brand mark: notification
// surfaces composite onto their own background, which can be dark.
const APP_ICON_URL = "/icons/icon-192.png";

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
        // Doubles as the browser notification `tag`, so this MUST match
        // the server's push tag byte-for-byte when a run id is known —
        // that's what collapses a page card and a server push into one.
        // Runs that ended before reporting a run id (a transport failure
        // mid-stream) fall back to the client turn id; the server never
        // pushes for those, so there is nothing to collide with.
        id: notice.runId
            ? `agent_run_done:${notice.runId}`
            : `agent_run_done:${notice.surface}:${notice.turnId}`,
        category: "agent_run_done",
        title: `${notice.error ? t.failedTitle : t.doneTitle} • ${surfaceLabel(notice.surface)}`,
        body: query ? fmt(t.body, { query }) : t.bodyNoQuery,
        // Without this the toast falls back to a letter avatar ("Y" for
        // "Your AI answer…") and the OS card to the browser default.
        icon: APP_ICON_URL,
        // NB: `senderId` is deliberately unset. The manager drops any
        // intent whose sender is the current user, and the person who
        // asked the question *is* the recipient — stamping it would
        // suppress every one of these notices as "self".
        onOpen: notice.onOpen,
    });
};
