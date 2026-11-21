import axios from "axios";

import { authApi } from "../../../services/api";

/**
 * "Agent Activity" tab (MIP-1613): the typed client for `GET /api/v2/agent/work/`.
 *
 * The shapes below are the API's real response (genos-api `services/agent_work.py`, PR
 * #1008), pinned by `src/__tests__/fixtures/agentWork.real.json`. The endpoint needs
 * `team_id` (400 without it, 404 for a team the viewer is not in), so every request
 * carries the current team. A 404 means the endpoint is not deployed yet (an older API)
 * or the viewer is outside the team; both get the calm "not available yet" state. A 400
 * (a bad filter) or a 5xx is `error`, with a retry.
 */

/** Who or what made a change. `person` is an in-app write (web app or in-app AI): unmarked. */
export type AgentKind = "claude" | "chatgpt" | "api_key" | "other_app" | "person";

/** What kind of work a row is. Also the `kind` query filter. */
export type AgentWorkKind =
    | "task_created"
    | "task_status"
    | "task_updated"
    | "task_comment"
    | "note"
    | "decision";

export const AGENT_KINDS: readonly AgentKind[] = [
    "claude",
    "chatgpt",
    "api_key",
    "other_app",
    "person",
];

export const AGENT_WORK_KINDS: readonly AgentWorkKind[] = [
    "task_created",
    "task_status",
    "task_updated",
    "task_comment",
    "note",
    "decision",
];

export type AgentWorkPeriod = 7 | 14 | 31;
export const AGENT_WORK_PERIODS: readonly AgentWorkPeriod[] = [7, 14, 31];

/**
 * The request: the filters plus the team. `null` means "all" (the parameter is left out).
 * `teamId` is required by the API, so it is part of the query, not an optional extra.
 */
export type AgentWorkQuery = {
    teamId: string;
    days: AgentWorkPeriod;
    projectId: number | null;
    agent: AgentKind | null;
    userId: string | null;
    kind: AgentWorkKind | null;
};

/**
 * The agent of a row. The API sends `null` for work done by a person (an unmarked write:
 * web app or in-app AI); the UI reads that as `person`. Otherwise the family of an app,
 * or the kind of the key or other app.
 */
export type AgentWorkAgent = {
    kind: Exclude<AgentKind, "person">;
    /** Set for a Claude or ChatGPT connection; never a key name or an app name. */
    app?: string | null;
};

export type AgentWorkUser = { id: string; name: string };

export type AgentWorkProject = { id: number; name: string; code?: string | null };

export type AgentWorkTotals = {
    by_agent: Partial<Record<AgentKind, number>>;
    decisions: number;
    changes: number;
};

export type AgentWorkUserAgentRow = {
    /** `null` only when the server could not name the person. */
    user: AgentWorkUser | null;
    agent: AgentKind;
    count: number;
    projects: AgentWorkProject[];
};

export type AgentWorkTarget = {
    type: "task" | "note" | string;
    id: number | string;
    title: string | null;
    /** A note's type as the API sends it: 1 personal, 2 on a task, 3 in chat. */
    note_type?: number | string | null;
    /** Not sent by the current API; when present the row links to the task or note. */
    project_id?: number | null;
    task_id?: number | null;
};

export type AgentWorkItem = {
    id: string;
    at: string;
    user: AgentWorkUser | null;
    /** `null` = a person's own write (unmarked). */
    agent: AgentWorkAgent | null;
    action: AgentWorkKind | string;
    target: AgentWorkTarget | null;
    /** Fenced text, cut to 280 characters by the server. Rendered as plain text only. */
    text: string | null;
};

export type AgentWorkGroupCounts = { total: number } & Partial<Record<AgentKind, number>>;

export type AgentWorkGroup = {
    /** `null` for work on no project (a personal note, for example). */
    project: AgentWorkProject | null;
    counts: AgentWorkGroupCounts;
    /** The rows of this page only; the counts describe the whole window. */
    items: AgentWorkItem[];
};

export type AgentWorkDecision = {
    note_id: number | string;
    /** 1 personal, 2 on a task (the API's numbers). */
    note_type?: number | string | null;
    title: string;
    at: string;
    user: AgentWorkUser | null;
    /** `null` = written by a person. */
    agent: AgentWorkAgent | null;
    /** Not sent by the current API; when present the row links to the note. */
    project_id?: number | null;
    task_id?: number | null;
};

/** A connected app's family: Claude, ChatGPT, or any other app (`other`). */
export type AgentWorkFamily = "claude" | "chatgpt" | "other";

export type AgentWorkConnection = {
    family: AgentWorkFamily;
    last_used_at: string | null;
};

export type AgentWorkPage = {
    window: { days: number; since: string; until: string };
    totals: AgentWorkTotals;
    by_user_agent: AgentWorkUserAgentRow[];
    groups: AgentWorkGroup[];
    decisions: AgentWorkDecision[];
    connections: AgentWorkConnection[];
    /** Opaque: pass it back as `cursor`. `null` on the last page. */
    next_cursor: string | null;
};

/** The request outcome. `unavailable` = 404; `error` = a 400, a 5xx or a network failure. */
export type AgentWorkResult =
    | { status: "ok"; page: AgentWorkPage }
    | { status: "unavailable" }
    | { status: "error" };

export const AGENT_WORK_PAGE_LIMIT = 50;

/** The query string for the request (snake_case, the API's names). */
export const agentWorkParams = (
    query: AgentWorkQuery,
    cursor: string | null,
    limit = AGENT_WORK_PAGE_LIMIT
): URLSearchParams => {
    const params = new URLSearchParams();
    params.set("team_id", query.teamId);
    params.set("days", String(query.days));
    if (query.projectId != null) params.set("project_id", String(query.projectId));
    if (query.agent) params.set("agent", query.agent);
    if (query.userId) params.set("user_id", query.userId);
    if (query.kind) params.set("kind", query.kind);
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);
    return params;
};

/** The key of a project group: its project id, or "none" for the work on no project. */
export const agentGroupKey = (group: Pick<AgentWorkGroup, "project">): string =>
    group.project ? String(group.project.id) : "none";

const emptyPage = (): AgentWorkPage => ({
    window: { days: 7, since: "", until: "" },
    totals: { by_agent: {}, decisions: 0, changes: 0 },
    by_user_agent: [],
    groups: [],
    decisions: [],
    connections: [],
    next_cursor: null,
});

/** Fill the parts a response may leave out, so the UI never reads `undefined`. */
const normalise = (raw: Partial<AgentWorkPage> | null): AgentWorkPage => {
    const base = emptyPage();
    if (!raw || typeof raw !== "object") return base;
    return {
        window: raw.window ?? base.window,
        totals: {
            by_agent: raw.totals?.by_agent ?? {},
            decisions: raw.totals?.decisions ?? 0,
            changes: raw.totals?.changes ?? 0,
        },
        by_user_agent: Array.isArray(raw.by_user_agent) ? raw.by_user_agent : [],
        groups: Array.isArray(raw.groups)
            ? raw.groups.map((g) => ({
                  ...g,
                  counts: g.counts ?? { total: 0 },
                  items: Array.isArray(g.items) ? g.items : [],
              }))
            : [],
        decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
        connections: Array.isArray(raw.connections) ? raw.connections : [],
        next_cursor: raw.next_cursor ?? null,
    };
};

/**
 * Load one page of agent activity for the query's team. Never throws: a 404 is
 * `unavailable`, any other failure is `error`, and the global error toast is suppressed
 * (the tab shows its own state). Pass an AbortSignal to drop a request whose filters
 * have since changed.
 */
export const loadAgentWork = async (
    accessToken: string | null,
    query: AgentWorkQuery,
    options: { cursor?: string | null; signal?: AbortSignal } = {}
): Promise<AgentWorkResult> => {
    const api = authApi(accessToken);
    if (!api || !query.teamId) return { status: "error" };
    try {
        const res = await api.get<Partial<AgentWorkPage>>("/agent/work/", {
            params: agentWorkParams(query, options.cursor ?? null),
            signal: options.signal,
            suppressErrorToast: true,
        });
        return { status: "ok", page: normalise(res.data) };
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { status: "unavailable" };
        }
        return { status: "error" };
    }
};
