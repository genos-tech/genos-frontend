import {
    AGENT_KINDS,
    AGENT_WORK_KINDS,
    AGENT_WORK_PERIODS,
    AgentKind,
    AgentWorkKind,
    AgentWorkPeriod,
    AgentWorkQuery,
} from "../services/loadAgentWork";

/**
 * The Agent Activity filters, kept in the URL query (MIP-1613) so a view can be shared
 * and filmed. Only non-default values are written; a bare `/workspace/tasks` has none.
 *
 *   period   7 | 14 | 31          (default 7)
 *   project  project id            (default all)
 *   agent    claude | chatgpt | api_key | other_app | person
 *   person   team member user id  (default everyone)
 *   kind     task_created | task_status | task_updated | task_comment | note | decision
 */
export const AGENT_VIEW_PARAM = "view";
export const AGENT_VIEW_VALUE = "agent";

export const DEFAULT_AGENT_PERIOD: AgentWorkPeriod = 7;

export type AgentFilters = {
    days: AgentWorkPeriod;
    projectId: number | null;
    agent: AgentKind | null;
    userId: string | null;
    kind: AgentWorkKind | null;
};

export const DEFAULT_AGENT_FILTERS: AgentFilters = {
    days: DEFAULT_AGENT_PERIOD,
    projectId: null,
    agent: null,
    userId: null,
    kind: null,
};

const PARAM = {
    period: "period",
    project: "project",
    agent: "agent",
    person: "person",
    kind: "kind",
} as const;

const oneOf = <T extends string | number>(allowed: readonly T[], raw: string | null): T | null => {
    if (raw == null || raw === "") return null;
    const hit = allowed.find((value) => String(value) === raw);
    return hit ?? null;
};

/** Read the filters from a query string. Unknown or malformed values fall back to "all". */
export const parseAgentFilters = (params: URLSearchParams): AgentFilters => {
    const period = oneOf(AGENT_WORK_PERIODS, params.get(PARAM.period));
    const projectRaw = params.get(PARAM.project);
    const projectId = projectRaw && /^\d+$/.test(projectRaw) ? Number(projectRaw) : null;
    const person = params.get(PARAM.person);
    return {
        days: period ?? DEFAULT_AGENT_PERIOD,
        projectId,
        agent: oneOf(AGENT_KINDS, params.get(PARAM.agent)),
        userId: person && person.length <= 64 ? person : null,
        kind: oneOf(AGENT_WORK_KINDS, params.get(PARAM.kind)),
    };
};

/**
 * Write the filters into a copy of `current`, leaving every other key (including
 * `view=agent`) as it was. A default or "all" value removes its key.
 */
export const writeAgentFilters = (
    current: URLSearchParams,
    filters: AgentFilters
): URLSearchParams => {
    const next = new URLSearchParams(current);
    const set = (key: string, value: string | null) => {
        if (value == null) next.delete(key);
        else next.set(key, value);
    };
    set(PARAM.period, filters.days === DEFAULT_AGENT_PERIOD ? null : String(filters.days));
    set(PARAM.project, filters.projectId == null ? null : String(filters.projectId));
    set(PARAM.agent, filters.agent);
    set(PARAM.person, filters.userId);
    set(PARAM.kind, filters.kind);
    return next;
};

/** The request's query: the filters as the API names them. */
export const agentFiltersToQuery = (filters: AgentFilters): AgentWorkQuery => ({
    days: filters.days,
    projectId: filters.projectId,
    agent: filters.agent,
    userId: filters.userId,
    kind: filters.kind,
});

/** True when any filter narrows the view (so an empty result means "no match", not "none"). */
export const hasActiveAgentFilters = (filters: AgentFilters): boolean =>
    filters.projectId != null ||
    filters.agent != null ||
    filters.userId != null ||
    filters.kind != null;
