import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/joy";
import { useLocation, useSearchParams } from "react-router-dom";

import { requestOpenSettings } from "../../../../../components/layout/settingsEvents";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import {
    AGENT_VIEW_PARAM,
    AGENT_VIEW_VALUE,
    AgentFilters,
    agentFiltersToQuery,
    DEFAULT_AGENT_FILTERS,
    hasActiveAgentFilters,
    parseAgentFilters,
    writeAgentFilters,
} from "../../../agentActivity/agentActivityFilters";
import { useAgentWork } from "../../../hooks/useAgentWork";
import { AgentKind, AgentWorkUserAgentRow } from "../../../services/loadAgentWork";
import { formatAgentWhen } from "./agentActivityLinks";
import { AgentConnectionsList } from "./AgentConnectionsList";
import { AgentDecisionsList } from "./AgentDecisionsList";
import { AgentFilterBar } from "./AgentFilterBar";
import { AgentProjectGroups } from "./AgentProjectGroups";
import { AgentSummaryRow } from "./AgentSummaryRow";
import { AgentWhoTable } from "./AgentWhoTable";

const TASKS_PATH = "/workspace/tasks";

type Props = {
    projects: { id: number; name: string }[];
};

/** The unique people in the window, for the Person filter (from the response, no extra request). */
const peopleFrom = (rows: AgentWorkUserAgentRow[]): { id: string; name: string }[] => {
    const seen = new Map<string, string>();
    for (const row of rows) {
        if (!seen.has(row.user.id)) seen.set(row.user.id, row.user.name);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
};

/**
 * The "Agent Activity" tab of the Tasks dashboard (MIP-1613): who uses which AI agent in
 * Genos, and for what. Filters live in the URL query so a view can be shared. Every
 * failure is a calm state here; nothing in this tab throws into the dashboard.
 */
export const AgentActivityTab = ({ projects }: Props) => {
    const { t, locale } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const location = useLocation();
    const [search, setSearch] = useSearchParams();

    // The Tasks home is kept mounted while another service is on screen, so only the
    // tasks route may read the query for a fetch or write it back.
    const onTasks = location.pathname.startsWith(TASKS_PATH);
    const pathRef = useRef(location.pathname);
    pathRef.current = location.pathname;

    const filters = useMemo(() => parseAgentFilters(search), [search]);
    const view = useAgentWork(agentFiltersToQuery(filters), onTasks);

    // Mark the URL with `view=agent` while this tab is open, so the view can be shared.
    useEffect(() => {
        if (!onTasks) return undefined;
        if (search.get(AGENT_VIEW_PARAM) !== AGENT_VIEW_VALUE) {
            setSearch(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set(AGENT_VIEW_PARAM, AGENT_VIEW_VALUE);
                    return next;
                },
                { replace: true }
            );
        }
        return () => {
            if (!pathRef.current.startsWith(TASKS_PATH)) return;
            setSearch(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete(AGENT_VIEW_PARAM);
                    return next;
                },
                { replace: true }
            );
        };
        // Only the tab's presence on the tasks route matters here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onTasks]);

    const applyFilters = (next: AgentFilters) => {
        setSearch((prev) => writeAgentFilters(prev, next), { replace: true });
    };
    const clearFilters = () => applyFilters(DEFAULT_AGENT_FILTERS);

    const page = view.page;
    const filtered = hasActiveAgentFilters(filters);
    const people = useMemo(() => {
        const list = peopleFrom(page?.by_user_agent ?? []);
        if (filters.userId && !list.some((p) => p.id === filters.userId)) {
            list.push({ id: filters.userId, name: "—" });
        }
        return list;
    }, [page, filters.userId]);

    const sectionLabel = a.heading;

    let body: ReactNode;
    if (view.status === "loading") {
        body = (
            <Typography level="body-sm" role="status" sx={{ color: g.text.secondary, py: 3 }}>
                {a.states.loading}
            </Typography>
        );
    } else if (view.status === "unavailable" || view.status === "error") {
        body = (
            <EmptyState
                action={{ label: a.states.retry, onClick: view.retry }}
                body={a.states.unavailableBody}
                data-empty="agent-activity-unavailable"
                size="md"
                title={a.states.unavailableTitle}
            />
        );
    } else if (page) {
        const nothingInWindow = page.totals.changes === 0 && page.decisions.length === 0;
        const latestConnection = [...page.connections].sort((x, y) =>
            (y.last_used_at ?? "").localeCompare(x.last_used_at ?? "")
        )[0];
        const familyLabel = (family: string) =>
            (["claude", "chatgpt", "api_key", "other_app", "person"] as const).includes(
                family as AgentKind
            )
                ? a.agents[family as AgentKind]
                : family;

        let empty: ReactNode = null;
        if (nothingInWindow && filtered) {
            empty = (
                <EmptyState
                    action={{ label: a.clearFilters, onClick: clearFilters }}
                    body={a.states.noMatchBody}
                    data-empty="agent-activity-no-match"
                    size="sm"
                    title={a.states.noMatchTitle}
                />
            );
        } else if (nothingInWindow && latestConnection) {
            empty = (
                <EmptyState
                    data-empty="agent-activity-no-writes"
                    size="sm"
                    title={fmt(a.states.connectedNoWrites, {
                        family: familyLabel(latestConnection.family),
                        when: formatAgentWhen(latestConnection.last_used_at, locale) || "—",
                    })}
                />
            );
        } else if (nothingInWindow) {
            empty = (
                <EmptyState
                    body={a.states.noneBody}
                    data-empty="agent-activity-none"
                    size="md"
                    title={fmt(a.states.noneTitle, { days: filters.days })}
                    action={{
                        label: a.states.connect,
                        onClick: () => requestOpenSettings("developer"),
                    }}
                />
            );
        }

        body = (
            <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                {empty}
                {!nothingInWindow && (
                    <>
                        <AgentSummaryRow totals={page.totals} />
                        {page.by_user_agent.length > 0 && (
                            <AgentWhoTable rows={page.by_user_agent} />
                        )}
                        {page.groups.length > 0 && (
                            <AgentProjectGroups
                                groups={page.groups}
                                hasMore={view.hasMore}
                                loadingMore={view.loadingMore}
                                loadMoreFailed={view.loadMoreFailed}
                                onLoadMore={view.loadMore}
                            />
                        )}
                        <AgentDecisionsList decisions={page.decisions} />
                    </>
                )}
                {(nothingInWindow || page.connections.length > 0) && (
                    <AgentConnectionsList connections={page.connections} />
                )}
            </Stack>
        );
    }

    return (
        <Box
            aria-label={sectionLabel}
            component="section"
            data-testid="agent-activity-tab"
            sx={{
                minWidth: 0,
                p: { xs: 1.5, md: 2 },
                borderRadius: g.radius.lg,
                border: `1px solid ${g.border.subtle}`,
                bgcolor: g.surface.default,
            }}
        >
            <Stack spacing={2} sx={{ minWidth: 0 }}>
                <Box>
                    <Typography component="h2" level="h4">
                        {a.heading}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: g.text.secondary, mt: 0.25 }}>
                        {a.subtitle}
                    </Typography>
                </Box>
                <AgentFilterBar
                    filters={filters}
                    people={people}
                    projects={projects}
                    onChange={applyFilters}
                    onClear={clearFilters}
                />
                {body}
                <Stack spacing={0.5} sx={{ pt: 1, borderTop: `1px solid ${g.border.subtle}` }}>
                    <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                        {a.footer.notIncluded}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                        {a.footer.privacy}
                    </Typography>
                </Stack>
            </Stack>
        </Box>
    );
};
