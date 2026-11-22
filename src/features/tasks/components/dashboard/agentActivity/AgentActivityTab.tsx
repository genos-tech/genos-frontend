import { useMemo, useRef, type ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/joy";
import { useLocation, useSearchParams } from "react-router-dom";

import { requestOpenSettings } from "../../../../../components/layout/settingsEvents";
import { SectionHeading } from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { SkeletonLines } from "../../../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import {
    AgentFilters,
    agentFiltersToQuery,
    DEFAULT_AGENT_FILTERS,
    hasActiveAgentFilters,
    parseAgentFilters,
    writeAgentFilters,
} from "../../../agentActivity/agentActivityFilters";
import { useAgentWork } from "../../../hooks/useAgentWork";
import { AgentWorkUserAgentRow } from "../../../services/loadAgentWork";
import type { ProjectIdentity } from "../../ProjectIdentityRow";
import { familyKind, formatAgentWhen } from "./agentActivityLinks";
import { AgentConnectionsList } from "./AgentConnectionsList";
import { AgentDecisionsList } from "./AgentDecisionsList";
import { AgentFilterBar } from "./AgentFilterBar";
import { AgentProjectGroups } from "./AgentProjectGroups";
import { AgentSummaryRow } from "./AgentSummaryRow";
import { AgentWhoTable } from "./AgentWhoTable";

const TASKS_PATH = "/workspace/tasks";

type Props = {
    projects: { id: number; name: string }[];
    /** The full project records (labels, lock, share mark), so the Project filter looks like the
     *  other project pickers (MIP-1916). Optional: a project without one shows its name only. */
    projectRecords?: readonly ProjectIdentity[];
    /** Project id -> avatar url (`projectAvatarSrcMap`); a project missing from it gets the icon. */
    projectAvatars?: Map<number, string>;
    /** The team the tab shows. The API needs it on every request; a change refetches. */
    teamId: string;
};

/** The unique people in the window, for the Person filter (from the response, no extra request). */
const peopleFrom = (rows: AgentWorkUserAgentRow[]): { id: string; name: string }[] => {
    const seen = new Map<string, string>();
    for (const row of rows) {
        if (row.user && !seen.has(row.user.id)) seen.set(row.user.id, row.user.name);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
};

/**
 * The "Agent Activity" tab of the Tasks dashboard (MIP-1613): who uses which AI agent in
 * Genos, and for what. Filters live in the URL query so a view can be shared. Every
 * failure is a calm state here; nothing in this tab throws into the dashboard.
 */
export const AgentActivityTab = ({ projects, projectRecords, projectAvatars, teamId }: Props) => {
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
    const view = useAgentWork(agentFiltersToQuery(filters, teamId), onTasks);

    const applyFilters = (next: AgentFilters) => {
        setSearch((prev) => writeAgentFilters(prev, next), { replace: true });
    };
    const clearFilters = () => applyFilters(DEFAULT_AGENT_FILTERS);

    const page = view.page;
    const filtered = hasActiveAgentFilters(filters);
    // The api filters `by_user_agent` by person and agent, so the list is accumulated from the
    // responses that were not narrowed (a filtered one adds only the chosen person), and reset on
    // a team change: picking A must not drop B from the Person list (MIP-1896). The merge is
    // idempotent, so doing it during render is safe.
    const peopleSeen = useRef<{ teamId: string; byId: Map<string, string> }>({
        teamId,
        byId: new Map(),
    });
    if (peopleSeen.current.teamId !== teamId) peopleSeen.current = { teamId, byId: new Map() };
    if (page) {
        const narrowed = filters.userId != null || filters.agent != null;
        for (const p of peopleFrom(page.by_user_agent)) {
            if (!narrowed || p.id === filters.userId) peopleSeen.current.byId.set(p.id, p.name);
        }
    }
    const people = [...peopleSeen.current.byId].map(([id, name]) => ({ id, name }));
    if (filters.userId && !people.some((p) => p.id === filters.userId)) {
        people.push({ id: filters.userId, name: "—" });
    }

    const sectionLabel = a.heading;

    let body: ReactNode;
    if (view.status === "loading") {
        body = <SkeletonLines label={a.states.loading} lines={4} />;
    } else if (view.status === "unavailable") {
        // 404: the API is not switched on for this workspace (or the viewer is outside the team).
        body = (
            <EmptyState
                action={{ label: a.states.retry, onClick: view.retry }}
                body={a.states.unavailableBody}
                data-empty="agent-activity-unavailable"
                size="md"
                title={a.states.unavailableTitle}
            />
        );
    } else if (view.status === "error") {
        // 400 (a request the client got wrong) or 5xx or a network failure: say so, offer a retry.
        body = (
            <EmptyState
                action={{ label: a.states.retry, onClick: view.retry }}
                body={a.states.errorBody}
                data-empty="agent-activity-error"
                size="md"
                title={a.states.errorTitle}
            />
        );
    } else if (page) {
        // The api builds `totals` from every filter except the agent, so under an agent filter
        // the agent's own count is what says whether anything matches (MIP-1896).
        const changesShown = filters.agent
            ? (page.totals.by_agent[filters.agent] ?? 0)
            : page.totals.changes;
        const nothingInWindow = changesShown === 0 && page.decisions.length === 0;
        const latestConnection = [...page.connections].sort((x, y) =>
            (y.last_used_at ?? "").localeCompare(x.last_used_at ?? "")
        )[0];
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
                        family: a.agents[familyKind(latestConnection.family)],
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
            sx={{ minWidth: 0 }}
        >
            <Stack spacing={3} sx={{ minWidth: 0 }}>
                <SectionHeading description={a.subtitle} title={a.heading} />
                <AgentFilterBar
                    filters={filters}
                    people={people}
                    projectAvatars={projectAvatars}
                    projectRecords={projectRecords}
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
