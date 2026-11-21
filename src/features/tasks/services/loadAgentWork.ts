import axios from "axios";

import { authApi } from "../../../services/api";

/**
 * "Agent Activity" tab (MIP-1613): the typed client for `GET /api/v2/agent/work/`.
 *
 * The contract is the spec note "Spec: Agent Activity tab in the Tasks dashboard
 * (MIP-1613)". The endpoint lands in genos-api in a separate PR, so until it is
 * deployed the real server answers 404. A 404 and any other failure both come back
 * as a non-OK result here; the tab turns them into a calm "not available yet" state
 * and never throws into the dashboard.
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

/** The filters the request carries. `null` means "all" (the parameter is left out). */
export type AgentWorkQuery = {
    days: AgentWorkPeriod;
    projectId: number | null;
    agent: AgentKind | null;
    userId: string | null;
    kind: AgentWorkKind | null;
};

export type AgentWorkAgent = {
    kind: AgentKind;
    /** Shown only in a tooltip or a detail line; never a reason to show a key name. */
    app?: string | null;
};

export type AgentWorkUser = { id: string; name: string };

export type AgentWorkTotals = {
    by_agent: Partial<Record<AgentKind, number>>;
    decisions: number;
    changes: number;
};

export type AgentWorkUserAgentRow = {
    user: AgentWorkUser;
    agent: AgentKind;
    count: number;
    projects: { id: number; name: string }[];
};

export type AgentWorkTarget = {
    type: "task" | "note" | string;
    id: number | string;
    title: string | null;
    /** For a task or a note inside a project: where the app opens it. */
    project_id?: number | null;
    /** For a note on a task. */
    task_id?: number | null;
    /** For a note's type when the server gives it (personal, task, chat). */
    note_type?: string | null;
};

export type AgentWorkItem = {
    id: string;
    at: string;
    user: AgentWorkUser | null;
    agent: AgentWorkAgent;
    action: AgentWorkKind | string;
    target: AgentWorkTarget | null;
    /** Fenced text, cut to 280 characters by the server. Rendered as plain text only. */
    text: string | null;
};

export type AgentWorkGroup = {
    project: { id: number; name: string; code?: string | null };
    counts: { changes: number; by_agent?: Partial<Record<AgentKind, number>> };
    items: AgentWorkItem[];
};

export type AgentWorkDecision = {
    note_id: number | string;
    note_type?: string | null;
    title: string;
    at: string;
    user: AgentWorkUser | null;
    agent: AgentWorkAgent;
    /** Where the note lives, when the server can name it. Without these it is shown unlinked. */
    project_id?: number | null;
    task_id?: number | null;
};

export type AgentWorkConnection = {
    family: AgentKind | string;
    last_used_at: string | null;
};

export type AgentWorkPage = {
    window: { days: number; start: string; end: string };
    totals: AgentWorkTotals;
    by_user_agent: AgentWorkUserAgentRow[];
    groups: AgentWorkGroup[];
    decisions: AgentWorkDecision[];
    connections: AgentWorkConnection[];
    next_cursor: string | null;
};

/** The request outcome. `unavailable` = 404 (not deployed yet); `error` = anything else. */
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
    params.set("days", String(query.days));
    if (query.projectId != null) params.set("project_id", String(query.projectId));
    if (query.agent) params.set("agent", query.agent);
    if (query.userId) params.set("user_id", query.userId);
    if (query.kind) params.set("kind", query.kind);
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);
    return params;
};

const emptyPage = (): AgentWorkPage => ({
    window: { days: 7, start: "", end: "" },
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
            ? raw.groups.map((g) => ({ ...g, items: Array.isArray(g.items) ? g.items : [] }))
            : [],
        decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
        connections: Array.isArray(raw.connections) ? raw.connections : [],
        next_cursor: raw.next_cursor ?? null,
    };
};

/**
 * Load one page of agent activity. Never throws: a 404 is `unavailable`, any other
 * failure is `error`, and the global error toast is suppressed (the tab shows its own
 * state). Pass an AbortSignal to drop a request whose filters have since changed.
 */
export const loadAgentWork = async (
    accessToken: string | null,
    query: AgentWorkQuery,
    options: { cursor?: string | null; signal?: AbortSignal } = {}
): Promise<AgentWorkResult> => {
    const api = authApi(accessToken);
    if (!api) return { status: "error" };
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
