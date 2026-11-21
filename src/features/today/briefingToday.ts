import axios from "axios";

import { authApi } from "../../services/api";
import { entityRefToHref } from "../../utils/entityHref";

/**
 * The "today" briefing (MIP-1005, MIP-1696): the typed client for
 * `GET /api/v2/briefing/today/` (genos-api `views/common/briefing_today_views.py`).
 *
 * It is the connected-app briefing (`get_my_briefing`) reshaped for a page, so what "changed"
 * and what "waits on me" mean is defined once, on the server. This module only types the
 * answer, loads it, and turns a row into the in-app path that opens it. A 404 means the API
 * has no such endpoint yet (or the viewer is outside the team): the calm "not available" state.
 */

export type BriefingTask = {
    taskId: number;
    displayId: string;
    title: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    daysUntilDue?: number;
    projectName?: string | null;
    projectId?: number;
    /** Why the briefing suggests it first (only on `suggestedNext`). */
    reasons?: string[];
};

export type BriefingRequest = {
    itemId: number | string;
    type: string | null;
    at: string | null;
    text: string | null;
    from: string | null;
};

export type BriefingMention = {
    source: "chat" | "task_comment" | "task" | "note" | string;
    at: string;
    text?: string | null;
    from?: string | null;
    by?: string | null;
    taskId?: number;
    projectId?: number;
    displayId?: string;
    title?: string | null;
    chatId?: string;
    chatType?: string | null;
    chatTitle?: string | null;
    threadId?: string | null;
    messageId?: string | number | null;
    noteType?: string;
    noteId?: number | string;
};

export type BriefingChange = {
    type: "task" | "thread" | "note" | string;
    taskId?: number;
    projectId?: number;
    displayId?: string;
    title?: string | null;
    status?: string;
    project?: string | null;
    assignedToMe?: boolean;
    noteType?: string;
    noteId?: number | string;
    chatId?: string;
    chatType?: string | null;
    threadId?: string | null;
    latestAt: string;
    eventsTotal: number;
    latest: { at?: string; what?: string; summary?: string; by?: string; text?: string };
};

export type BriefingBlocked = {
    taskId: number;
    projectId?: number;
    displayId: string;
    title: string;
    waitingFor: { displayId: string; title: string; assignee?: string }[];
};

export type BriefingToday = {
    window: { since: string; until: string; timeZone: string; localDate: string };
    overdue: BriefingTask[];
    overdueCount: number;
    dueToday: BriefingTask[];
    dueTodayCount: number;
    requests: BriefingRequest[];
    mentions: BriefingMention[];
    changed: { items: BriefingChange[]; total: number; truncated: boolean };
    suggestedNext: BriefingTask[];
    blocked: BriefingBlocked[];
    delegated: BriefingTask[];
    delegatedTotal: number;
};

export type BriefingTodayResult =
    | { status: "ok"; data: BriefingToday }
    | { status: "unavailable" }
    | { status: "error" };

const list = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

/** Fill what an older or partial answer leaves out, so the page never reads `undefined.length`. */
export const normaliseBriefing = (raw: Partial<BriefingToday>): BriefingToday => ({
    window: raw.window ?? { since: "", until: "", timeZone: "UTC", localDate: "" },
    overdue: list(raw.overdue),
    overdueCount: raw.overdueCount ?? list(raw.overdue).length,
    dueToday: list(raw.dueToday),
    dueTodayCount: raw.dueTodayCount ?? list(raw.dueToday).length,
    requests: list(raw.requests),
    mentions: list(raw.mentions),
    changed: {
        items: list(raw.changed?.items),
        total: raw.changed?.total ?? list(raw.changed?.items).length,
        truncated: raw.changed?.truncated ?? false,
    },
    suggestedNext: list(raw.suggestedNext),
    blocked: list(raw.blocked).map((b) => ({ ...b, waitingFor: list(b.waitingFor) })),
    delegated: list(raw.delegated),
    delegatedTotal: raw.delegatedTotal ?? list(raw.delegated).length,
});

/** Load the briefing. Never throws: 404 is `unavailable`, anything else `error`. */
export const loadBriefingToday = async (
    accessToken: string | null,
    teamId: string,
    since: string | null,
    signal?: AbortSignal
): Promise<BriefingTodayResult> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return { status: "error" };
    try {
        const res = await api.get<Partial<BriefingToday>>("/briefing/today/", {
            params: { team_id: teamId, ...(since ? { since } : {}) },
            signal,
            suppressErrorToast: true,
        });
        return { status: "ok", data: normaliseBriefing(res.data) };
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { status: "unavailable" };
        }
        return { status: "error" };
    }
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const safe = (v: unknown): v is string | number => v != null && SAFE_ID.test(String(v));

/** The path of a task, `null` when the answer did not name its project. */
export const taskHref = (t: { taskId?: number; projectId?: number }): string | null =>
    safe(t.taskId) && safe(t.projectId)
        ? entityRefToHref({
              entityType: "task",
              projectId: String(t.projectId),
              taskId: String(t.taskId),
          })
        : null;

type NoteRef = {
    noteType?: string;
    noteId?: number | string;
    taskId?: number;
    projectId?: number;
};

const noteHref = (n: NoteRef): string | null => {
    if (!safe(n.noteId)) return null;
    if (n.noteType === "personal") {
        return entityRefToHref({ entityType: "note", noteKind: "my", noteId: String(n.noteId) });
    }
    if (n.noteType === "task" && safe(n.taskId) && safe(n.projectId)) {
        return entityRefToHref({
            entityType: "note",
            noteKind: "task",
            projectId: String(n.projectId),
            taskId: String(n.taskId),
            noteId: String(n.noteId),
        });
    }
    return null;
};

type ChatRef = {
    chatId?: string;
    chatType?: string | null;
    threadId?: string | null;
    messageId?: string | number | null;
};

const chatHref = (c: ChatRef): string | null => {
    if (!safe(c.chatId) || !safe(c.chatType)) return null;
    const base = entityRefToHref({
        entityType: "chat",
        chatType: String(c.chatType),
        chatId: String(c.chatId),
    });
    const thread = safe(c.threadId) ? `${base}/thread/${c.threadId}` : base;
    return safe(c.messageId) ? `${thread}/message/${c.messageId}` : thread;
};

/** Where a mention opens: its task, note or chat message. `null` shows the row as text. */
export const mentionHref = (m: BriefingMention): string | null =>
    m.source === "chat" ? chatHref(m) : m.source === "note" ? noteHref(m) : taskHref(m);

/** Where a changed item opens. */
export const changeHref = (c: BriefingChange): string | null =>
    c.type === "task"
        ? taskHref(c)
        : c.type === "note"
          ? noteHref(c)
          : chatHref({ ...c, messageId: null });

// ── "Since I last looked" (a per-viewer convenience: the browser keeps it) ──────────────

const lastLookedKey = (userId: string, teamId: string) =>
    `genos.today.lastLooked.${userId}.${teamId}`;
const sessionSinceKey = (userId: string, teamId: string) =>
    `genos.today.since.${userId}.${teamId}`;
const MAX_BACK_MS = 30 * 24 * 3600 * 1000; // the API refuses more than 31 days

const read = (store: () => Storage, key: string): string | null => {
    try {
        return store().getItem(key);
    } catch {
        return null;
    }
};
const write = (store: () => Storage, key: string, value: string): void => {
    try {
        store().setItem(key, value);
    } catch {
        /* private mode or blocked storage: the page still works, it just forgets */
    }
};

const validSince = (value: string | null, now: number): string | null => {
    if (!value) return null;
    const ms = Date.parse(value);
    if (Number.isNaN(ms) || ms > now || ms < now - MAX_BACK_MS) return null;
    return new Date(ms).toISOString();
};

/**
 * The time the list counts changes from. A reload in the same tab keeps it (so the list does not
 * empty itself); a new tab session starts from when the viewer last left the page. `null` on a
 * first visit: the API then answers with the local day so far.
 */
export const sinceForView = (userId: string, teamId: string, now = Date.now()): string | null => {
    const fromSession = validSince(
        read(() => window.sessionStorage, sessionSinceKey(userId, teamId)),
        now
    );
    if (fromSession) return fromSession;
    const fromLast = validSince(
        read(() => window.localStorage, lastLookedKey(userId, teamId)),
        now
    );
    if (fromLast) write(() => window.sessionStorage, sessionSinceKey(userId, teamId), fromLast);
    return fromLast;
};

/** Remember that the viewer has now seen what is on the page (called when they leave it). */
export const markLooked = (userId: string, teamId: string, now = Date.now()): void => {
    write(() => window.localStorage, lastLookedKey(userId, teamId), new Date(now).toISOString());
};

/** Whether the answer has anything to show (the Genos page shows its card only then). */
export const hasBriefingNews = (d: BriefingToday | null): boolean =>
    d != null &&
    d.overdueCount + d.dueTodayCount + d.requests.length + d.mentions.length + d.changed.total > 0;
