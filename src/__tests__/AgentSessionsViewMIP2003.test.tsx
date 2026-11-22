/**
 * MIP-2003: the Sessions view, the app strip, the refused/failed list and the
 * "no completion comment" flag of the Agent Activity tab. Layout at 390 and 1440 px
 * is not testable in jsdom; it is checked in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OPEN_SETTINGS_EVENT } from "../components/layout/settingsEvents";
import {
    buildAppStrip,
    groupsForSession,
    sessionMatchesItem,
} from "../features/tasks/agentActivity/agentSessions";
import { AgentActivityTab } from "../features/tasks/components/dashboard/agentActivity/AgentActivityTab";
import type {
    AgentWorkItem,
    AgentWorkPage,
    AgentWorkSession,
} from "../features/tasks/services/loadAgentWork";
import { authApi } from "../services/api";

vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: ({ userId }: { userId: string }) => <span data-testid={`user-avatar-${userId}`} />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn().mockResolvedValue([]),
}));

const get = vi.fn();

const session = (over: Partial<AgentWorkSession> = {}): AgentWorkSession => ({
    run_id: "run-a",
    agent: "claude",
    started_at: "2026-11-21T10:00:00Z",
    ended_at: "2026-11-21T10:30:00Z",
    calls: 20,
    opened: 14,
    searched: 3,
    changed: 6,
    decided: 1,
    refused: 0,
    failed: 0,
    commented: 1,
    no_completion_comment: false,
    items_touched: 14,
    items_changed: 6,
    ...over,
});

const row = (id: string, at: string, agent: AgentWorkItem["agent"]): AgentWorkItem => ({
    id,
    at,
    user: { id: "u1", name: "Ana" },
    agent,
    action: "task_updated",
    target: {
        type: "task",
        id: Number(id.replace(/\D/g, "")),
        title: `Task ${id}`,
        project_id: 1,
    },
    text: null,
});

const page = (sessions: AgentWorkSession[]): AgentWorkPage => ({
    window: { days: 7, since: "2026-11-14T00:00:00Z", until: "2026-11-22T00:00:00Z" },
    totals: { by_agent: { claude: 2 }, decisions: 0, changes: 2 },
    by_user_agent: [],
    groups: [
        {
            project: { id: 1, name: "Launch" },
            counts: { total: 2 },
            items: [
                row("i-1", "2026-11-21T10:10:00Z", { kind: "claude" }),
                row("i-2", "2026-11-21T15:00:00Z", { kind: "claude" }),
            ],
        },
    ],
    decisions: [],
    connections: [{ family: "claude", last_used_at: "2026-11-21T10:30:00Z" }],
    sessions: { items: sessions, total: sessions.length },
    next_cursor: null,
});

const renderTab = () =>
    render(
        <CssVarsProvider>
            <ThemeProvider theme={{ [THEME_ID]: createTheme({ cssVariables: true }) }}>
                <MemoryRouter initialEntries={["/workspace/tasks?view=agent"]}>
                    <Routes>
                        <Route
                            element={<AgentActivityTab projects={[]} teamId="team-1" />}
                            path="/workspace/tasks"
                        />
                    </Routes>
                </MemoryRouter>
            </ThemeProvider>
        </CssVarsProvider>
    );

beforeEach(() => {
    get.mockReset();
    vi.mocked(authApi).mockReset();
    vi.mocked(authApi).mockReturnValue({ get } as unknown as ReturnType<typeof authApi>);
});

describe("agentSessions helpers", () => {
    it("matches a change row to a session by app and time span, not by id", () => {
        const s = session();
        expect(sessionMatchesItem(s, row("i-1", "2026-11-21T10:10:00Z", { kind: "claude" }))).toBe(
            true
        );
        expect(sessionMatchesItem(s, row("i-2", "2026-11-21T15:00:00Z", { kind: "claude" }))).toBe(
            false
        );
        expect(
            sessionMatchesItem(s, row("i-3", "2026-11-21T10:10:00Z", { kind: "chatgpt" }))
        ).toBe(false);
        expect(sessionMatchesItem(s, row("i-4", "2026-11-21T10:10:00Z", null))).toBe(false);
    });

    it("narrows groups to the session and drops the groups left empty", () => {
        const groups = page([session()]).groups;
        const narrowed = groupsForSession(groups, session());
        expect(narrowed).toHaveLength(1);
        expect(narrowed[0].items.map((i) => i.id)).toEqual(["i-1"]);
        expect(narrowed[0].counts.total).toBe(1);
        expect(groupsForSession(groups, session({ started_at: null }))).toEqual([]);
    });

    it("sums today's calls, changes and refusals per app, and counts a run once on the day it ended", () => {
        const now = new Date(2026, 10, 21, 18, 0, 0);
        const todayIso = new Date(2026, 10, 21, 9, 0, 0).toISOString();
        const yesterdayIso = new Date(2026, 10, 20, 9, 0, 0).toISOString();
        const rows = buildAppStrip(
            [
                { family: "other", last_used_at: null },
                { family: "claude", last_used_at: yesterdayIso },
            ],
            [
                session({ run_id: "a", ended_at: todayIso, calls: 10, changed: 2, refused: 1 }),
                session({ run_id: "b", ended_at: todayIso, calls: 5, changed: 1, failed: 2 }),
                session({
                    run_id: "c",
                    ended_at: yesterdayIso,
                    calls: 99,
                    changed: 9,
                    no_completion_comment: true,
                }),
            ],
            now
        );
        expect(rows.map((r) => r.kind)).toEqual(["claude", "other_app"]);
        expect(rows[0]).toMatchObject({
            callsToday: 15,
            changesToday: 3,
            refusedToday: 1,
            failedToday: 2,
            noComment: 1,
        });
        expect(rows[0].lastUsedAt).toBe(todayIso);
        expect(rows[1]).toMatchObject({ callsToday: 0, lastUsedAt: null });
    });
});

describe("Sessions view in the Agent Activity tab", () => {
    it("lists a session with counts, flags a run with no completion comment, and links the app strip to Settings", async () => {
        get.mockResolvedValue({
            data: page([
                session({ run_id: "a", no_completion_comment: true, commented: 0 }),
                session({
                    run_id: "b",
                    started_at: "2026-11-21T08:00:00Z",
                    ended_at: "2026-11-21T08:05:00Z",
                }),
            ]),
        });
        renderTab();
        const rows = await screen.findAllByTestId("agent-session-row");
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getByText("14")).toBeTruthy();
        expect(within(rows[0]).getByTestId("agent-session-no-comment")).toBeTruthy();
        expect(within(rows[1]).queryByTestId("agent-session-no-comment")).toBeNull();
        expect(screen.getAllByTestId("agent-app-strip-row")).toHaveLength(1);

        const opened = vi.fn();
        window.addEventListener(OPEN_SETTINGS_EVENT, opened);
        fireEvent.click(screen.getByRole("button", { name: "Manage or disconnect" }));
        expect(opened).toHaveBeenCalled();
        window.removeEventListener(OPEN_SETTINGS_EVENT, opened);
    });

    it("narrows the change list to one session on click and back on Show all", async () => {
        get.mockResolvedValue({ data: page([session()]) });
        renderTab();
        expect(await screen.findByText("Task i-1")).toBeTruthy();
        expect(screen.getByText("Task i-2")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Show these changes" }));
        expect(screen.getByText("Task i-1")).toBeTruthy();
        expect(screen.queryByText("Task i-2")).toBeNull();
        expect(screen.getByTestId("agent-session-filter-banner")).toBeTruthy();

        fireEvent.click(screen.getAllByRole("button", { name: "Show all changes" })[0]);
        expect(screen.getByText("Task i-2")).toBeTruthy();
    });

    it("shows the refused and failed sessions on demand, as counts", async () => {
        get.mockResolvedValue({
            data: page([
                session({ run_id: "a", refused: 2 }),
                session({ run_id: "b", failed: 1 }),
                session({ run_id: "c" }),
            ]),
        });
        renderTab();
        expect(await screen.findAllByTestId("agent-session-row")).toHaveLength(3);
        fireEvent.click(screen.getByTestId("agent-sessions-problems-toggle"));
        expect(screen.getAllByTestId("agent-session-row")).toHaveLength(2);
        expect(screen.getByText(/no call content is stored/)).toBeTruthy();
    });

    it("says so, calmly, when the call log has no sessions yet", async () => {
        get.mockResolvedValue({ data: page([]) });
        renderTab();
        expect(await screen.findByText("No sessions in this period")).toBeTruthy();
        expect(screen.queryAllByTestId("agent-session-row")).toHaveLength(0);
    });
});
