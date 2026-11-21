/**
 * MIP-1613: the Agent Activity tab of the Tasks dashboard.
 *
 * Covers the typed client and hook states (loading, data, empty, 404 and error), the
 * query each filter sends, the URL round trip, the chip per agent kind, the honest empty
 * states, the phone filter sheet, and the tab in the dashboard strip. Layout at 390 and
 * 1440 px is not testable in jsdom; it is checked in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import {
    act,
    fireEvent,
    render,
    renderHook,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OPEN_SETTINGS_EVENT } from "../components/layout/settingsEvents";
import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import {
    AGENT_VIEW_PARAM,
    AgentFilters,
    agentFiltersToQuery,
    DEFAULT_AGENT_FILTERS,
    parseAgentFilters,
    writeAgentFilters,
} from "../features/tasks/agentActivity/agentActivityFilters";
import { AgentChip } from "../features/tasks/components/dashboard/agentActivity/agentActivityParts";
import { AgentActivityTab } from "../features/tasks/components/dashboard/agentActivity/AgentActivityTab";
import { TaskDashboard } from "../features/tasks/components/dashboard/TaskDashboard";
import { mergeAgentWorkPages, useAgentWork } from "../features/tasks/hooks/useAgentWork";
import {
    AgentWorkPage,
    agentWorkParams,
    loadAgentWork,
} from "../features/tasks/services/loadAgentWork";
import { authApi } from "../services/api";

const { mobileFlag } = vi.hoisted(() => ({ mobileFlag: { value: false } }));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../services/api", () => ({
    authApi: vi.fn(),
}));
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => mobileFlag.value,
}));
vi.mock("../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn().mockResolvedValue([]),
}));

const get = vi.fn();

/** An error shaped the way axios reports an HTTP failure. */
const httpError = (status: number) =>
    Object.assign(new Error(`HTTP ${status}`), {
        isAxiosError: true,
        response: { status },
    });

const makePage = (overrides: Partial<AgentWorkPage> = {}): AgentWorkPage => ({
    window: { days: 7, start: "2026-11-14", end: "2026-11-21" },
    totals: {
        by_agent: { claude: 31, chatgpt: 2, api_key: 1, other_app: 0, person: 12 },
        decisions: 1,
        changes: 46,
    },
    by_user_agent: [
        {
            user: { id: "u-ana", name: "Ana" },
            agent: "claude",
            count: 9,
            projects: [
                { id: 1, name: "Launch" },
                { id: 2, name: "Support" },
                { id: 3, name: "Ops" },
                { id: 4, name: "Sales" },
            ],
        },
        {
            user: { id: "u-ken", name: "Ken" },
            agent: "person",
            count: 3,
            projects: [{ id: 1, name: "Launch" }],
        },
    ],
    groups: [
        {
            project: { id: 1, name: "Launch", code: "LAU" },
            counts: { changes: 19 },
            items: [
                {
                    id: "i-1",
                    at: "2026-11-21T10:42:00Z",
                    user: { id: "u-ana", name: "Ana" },
                    agent: { kind: "claude" },
                    action: "task_created",
                    target: { type: "task", id: 77, title: "Pricing page copy", project_id: 1 },
                    text: "Option B reads better for a first-time buyer.",
                },
                {
                    id: "i-2",
                    at: "2026-11-21T09:10:00Z",
                    user: null,
                    agent: { kind: "person" },
                    action: "task_status",
                    target: { type: "task", id: 78, title: "Waitlist form", project_id: 1 },
                    text: null,
                },
            ],
        },
    ],
    decisions: [
        {
            note_id: 9,
            note_type: "personal",
            title: "Decision: refund window is 30 days",
            at: "2026-11-19T08:00:00Z",
            user: { id: "u-ken", name: "Ken" },
            agent: { kind: "claude" },
        },
    ],
    connections: [{ family: "claude", last_used_at: "2026-11-21T10:44:00Z" }],
    next_cursor: null,
    ...overrides,
});

const emptyPage = (overrides: Partial<AgentWorkPage> = {}): AgentWorkPage =>
    makePage({
        totals: { by_agent: {}, decisions: 0, changes: 0 },
        by_user_agent: [],
        groups: [],
        decisions: [],
        connections: [],
        ...overrides,
    });

const okWith = (page: AgentWorkPage) => ({ data: page });

/** The query the client sent, as a plain object (the client passes URLSearchParams). */
const sent = (callIndex: number): Record<string, string> =>
    Object.fromEntries(get.mock.calls[callIndex][1].params as URLSearchParams);

beforeEach(() => {
    get.mockReset();
    mobileFlag.value = false;
    vi.mocked(authApi).mockReset();
    vi.mocked(authApi).mockReturnValue({ get } as unknown as ReturnType<typeof authApi>);
});

// ---------------------------------------------------------------------------
// The client and the hook
// ---------------------------------------------------------------------------

describe("loadAgentWork (typed client)", () => {
    it("maps a 404 to unavailable and any other failure to error", async () => {
        get.mockRejectedValueOnce(httpError(404));
        await expect(
            loadAgentWork("t", agentFiltersToQuery(DEFAULT_AGENT_FILTERS))
        ).resolves.toEqual({ status: "unavailable" });

        get.mockRejectedValueOnce(httpError(500));
        await expect(
            loadAgentWork("t", agentFiltersToQuery(DEFAULT_AGENT_FILTERS))
        ).resolves.toEqual({ status: "error" });
    });

    it("fills the parts a response leaves out, so the UI never reads undefined", async () => {
        get.mockResolvedValueOnce({ data: { totals: { changes: 2 } } });
        const result = await loadAgentWork("t", agentFiltersToQuery(DEFAULT_AGENT_FILTERS));
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.page.groups).toEqual([]);
        expect(result.page.decisions).toEqual([]);
        expect(result.page.connections).toEqual([]);
        expect(result.page.totals.changes).toBe(2);
        expect(result.page.next_cursor).toBeNull();
    });

    it("sends only the filters that are set, with the API's parameter names", () => {
        const params = agentWorkParams(
            { days: 14, projectId: 3, agent: "chatgpt", userId: "u-1", kind: "decision" },
            "c-9"
        );
        expect(Object.fromEntries(params)).toEqual({
            days: "14",
            project_id: "3",
            agent: "chatgpt",
            user_id: "u-1",
            kind: "decision",
            limit: "50",
            cursor: "c-9",
        });
        const bare = agentWorkParams(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), null);
        expect(Object.fromEntries(bare)).toEqual({ days: "7", limit: "50" });
    });
});

describe("useAgentWork (hook states)", () => {
    it("is loading first, then ready with data", async () => {
        get.mockResolvedValueOnce(okWith(makePage()));
        const { result } = renderHook(() =>
            useAgentWork(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), true)
        );
        expect(result.current.status).toBe("loading");
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.page?.totals.by_agent.claude).toBe(31);
        expect(result.current.hasMore).toBe(false);
    });

    it("is ready with an empty page when nothing happened", async () => {
        get.mockResolvedValueOnce(okWith(emptyPage()));
        const { result } = renderHook(() =>
            useAgentWork(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), true)
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.page?.totals.changes).toBe(0);
        expect(result.current.page?.groups).toEqual([]);
    });

    it("reports unavailable on 404 and error on 500, and retries", async () => {
        get.mockRejectedValueOnce(httpError(404));
        const { result } = renderHook(() =>
            useAgentWork(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), true)
        );
        await waitFor(() => expect(result.current.status).toBe("unavailable"));
        expect(result.current.page).toBeNull();

        get.mockRejectedValueOnce(httpError(500));
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.status).toBe("error"));

        get.mockResolvedValueOnce(okWith(makePage()));
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.status).toBe("ready"));
    });

    it("does not fetch while disabled (the Tasks home is kept mounted elsewhere)", () => {
        renderHook(() => useAgentWork(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), false));
        expect(get).not.toHaveBeenCalled();
    });

    it("refetches when a filter changes, and only then", async () => {
        get.mockResolvedValue(okWith(makePage()));
        const { result, rerender } = renderHook(
            ({ filters }: { filters: AgentFilters }) =>
                useAgentWork(agentFiltersToQuery(filters), true),
            { initialProps: { filters: DEFAULT_AGENT_FILTERS } }
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        rerender({ filters: DEFAULT_AGENT_FILTERS });
        expect(get).toHaveBeenCalledTimes(1);
        rerender({ filters: { ...DEFAULT_AGENT_FILTERS, days: 14 } });
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(sent(1).days).toBe("14");
    });

    it("loads more on the server cursor and folds the rows into their project", async () => {
        get.mockResolvedValueOnce(okWith(makePage({ next_cursor: "c-2" })));
        const { result } = renderHook(() =>
            useAgentWork(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), true)
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.hasMore).toBe(true);

        get.mockResolvedValueOnce(
            okWith(
                makePage({
                    next_cursor: null,
                    groups: [
                        {
                            project: { id: 1, name: "Launch" },
                            counts: { changes: 1 },
                            items: [
                                {
                                    id: "i-3",
                                    at: "2026-11-20T09:00:00Z",
                                    user: null,
                                    agent: { kind: "api_key" },
                                    action: "task_updated",
                                    target: {
                                        type: "task",
                                        id: 80,
                                        title: "Old item",
                                        project_id: 1,
                                    },
                                    text: null,
                                },
                            ],
                        },
                    ],
                })
            )
        );
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.hasMore).toBe(false));
        expect(sent(1).cursor).toBe("c-2");
        expect(result.current.page?.groups).toHaveLength(1);
        expect(result.current.page?.groups[0].items.map((i) => i.id)).toEqual([
            "i-1",
            "i-2",
            "i-3",
        ]);
    });

    it("keeps the rows on screen when Load more fails", async () => {
        get.mockResolvedValueOnce(okWith(makePage({ next_cursor: "c-2" })));
        const { result } = renderHook(() =>
            useAgentWork(agentFiltersToQuery(DEFAULT_AGENT_FILTERS), true)
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        get.mockRejectedValueOnce(httpError(500));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));
        expect(result.current.status).toBe("ready");
        expect(result.current.page?.groups[0].items).toHaveLength(2);
    });

    it("merges pages without touching the first page's totals", () => {
        const first = makePage({ next_cursor: "c" });
        const merged = mergeAgentWorkPages(
            first,
            makePage({ next_cursor: null, totals: { by_agent: {}, decisions: 99, changes: 99 } })
        );
        expect(merged.totals.changes).toBe(46);
        expect(merged.next_cursor).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Filters and the URL
// ---------------------------------------------------------------------------

describe("agent filters in the URL", () => {
    it("round-trips every filter through the query string", () => {
        const filters: AgentFilters = {
            days: 31,
            projectId: 12,
            agent: "api_key",
            userId: "u-ana",
            kind: "task_comment",
        };
        const written = writeAgentFilters(new URLSearchParams("view=agent&other=1"), filters);
        expect(written.get("view")).toBe("agent");
        expect(written.get("other")).toBe("1");
        expect(parseAgentFilters(written)).toEqual(filters);
    });

    it("leaves default and all-values out of the URL", () => {
        const written = writeAgentFilters(
            new URLSearchParams("period=14&agent=claude"),
            DEFAULT_AGENT_FILTERS
        );
        expect([...written.keys()]).toEqual([]);
    });

    it("ignores unknown or malformed values rather than sending them", () => {
        const parsed = parseAgentFilters(
            new URLSearchParams("period=9&project=abc&agent=gpt9&person=&kind=delete")
        );
        expect(parsed).toEqual(DEFAULT_AGENT_FILTERS);
    });

    it("the view parameter name is the one the Tasks home reads", () => {
        expect(AGENT_VIEW_PARAM).toBe("view");
    });
});

// ---------------------------------------------------------------------------
// Chips, states and the rendered tab
// ---------------------------------------------------------------------------

const renderAt = (url: string, ui: React.ReactElement) =>
    render(
        <CssVarsProvider>
            <ThemeProvider theme={{ [THEME_ID]: createTheme({ cssVariables: true }) }}>
                <MemoryRouter initialEntries={[url]}>
                    <Routes>
                        <Route path="/workspace/tasks" element={ui} />
                        <Route path="*" element={<div>elsewhere</div>} />
                    </Routes>
                </MemoryRouter>
            </ThemeProvider>
        </CssVarsProvider>
    );

const projects = [
    { id: 1, name: "Launch" },
    { id: 2, name: "Support" },
];

describe("AgentChip", () => {
    it.each([
        ["claude", "Claude"],
        ["chatgpt", "ChatGPT"],
        ["api_key", "API key"],
        ["other_app", "Other app"],
        ["person", "by people in the app"],
    ] as const)("renders %s with its own label and kind marker", (kind, label) => {
        render(
            <CssVarsProvider>
                <AgentChip agent={{ kind }} label={label} />
            </CssVarsProvider>
        );
        const chip = screen.getByText(label);
        expect(chip.closest("[data-agent-kind]")?.getAttribute("data-agent-kind")).toBe(kind);
    });
});

describe("AgentActivityTab (rendered)", () => {
    it("shows the summary, who-uses-which-agent table, project groups and decisions", async () => {
        get.mockResolvedValueOnce(okWith(makePage()));
        renderAt("/workspace/tasks?view=agent", <AgentActivityTab projects={projects} />);
        expect(await screen.findByText("Pricing page copy")).toBeTruthy();

        expect(screen.getByTestId("agent-total-claude").textContent).toBe("31");
        expect(screen.getByTestId("agent-total-decisions").textContent).toBe("1");

        const table = screen.getByRole("table", { name: "Who uses which agent" });
        expect(within(table).getByRole("columnheader", { name: "Person" })).toBeTruthy();
        expect(within(table).getByText("Ana")).toBeTruthy();
        // Projects: the top three, then "+N more".
        expect(within(table).getByText("Launch, Support, Ops +1 more")).toBeTruthy();

        expect(screen.getByRole("heading", { name: "Launch" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Open Pricing page copy" })).toBeTruthy();
        expect(screen.getByText("Decision: refund window is 30 days")).toBeTruthy();
        expect(screen.getByText("Option B reads better for a first-time buyer.").tagName).toBe(
            "PRE"
        );
    });

    it("sorts the who table by change count only, and says so with aria-sort", async () => {
        get.mockResolvedValueOnce(okWith(makePage()));
        renderAt("/workspace/tasks?view=agent", <AgentActivityTab projects={projects} />);
        await screen.findByText("Pricing page copy");
        const table = screen.getByRole("table", { name: "Who uses which agent" });
        const countHeader = within(table).getByRole("columnheader", { name: /Changes/ });
        expect(countHeader.getAttribute("aria-sort")).toBe("descending");
        const firstRow = () => within(table).getAllByRole("row")[1].textContent ?? "";
        expect(firstRow()).toContain("Ana");
        fireEvent.click(within(countHeader).getByRole("button"));
        expect(countHeader.getAttribute("aria-sort")).toBe("ascending");
        expect(firstRow()).toContain("Ken");
    });

    it("shows the calm unavailable state on 404, with a retry", async () => {
        get.mockRejectedValueOnce(httpError(404));
        renderAt("/workspace/tasks?view=agent", <AgentActivityTab projects={projects} />);
        expect(await screen.findByText("Agent activity is not available yet")).toBeTruthy();
        get.mockResolvedValueOnce(okWith(makePage()));
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("Pricing page copy")).toBeTruthy();
    });

    it("says no AI app has written, and Connect Claude asks Settings for Developer", async () => {
        get.mockResolvedValueOnce(okWith(emptyPage()));
        const requested: string[] = [];
        const listener = (event: Event) =>
            requested.push((event as CustomEvent<{ tab?: string }>).detail?.tab ?? "");
        window.addEventListener(OPEN_SETTINGS_EVENT, listener);
        try {
            renderAt("/workspace/tasks?view=agent", <AgentActivityTab projects={projects} />);
            expect(
                await screen.findByText("No AI app has written to Genos in the last 7 days.")
            ).toBeTruthy();
            fireEvent.click(screen.getByRole("button", { name: "Connect Claude" }));
            expect(requested).toEqual(["developer"]);
        } finally {
            window.removeEventListener(OPEN_SETTINGS_EVENT, listener);
        }
    });

    it("says a connected app has not written yet, instead of 'no activity'", async () => {
        get.mockResolvedValueOnce(
            okWith(emptyPage({ connections: [{ family: "claude", last_used_at: null }] }))
        );
        renderAt("/workspace/tasks?view=agent", <AgentActivityTab projects={projects} />);
        expect(await screen.findByText(/Claude connected .*No writes yet\./)).toBeTruthy();
        expect(screen.getByText("No writes yet")).toBeTruthy();
    });

    it("offers Clear filters when a filter matches nothing", async () => {
        get.mockResolvedValue(
            okWith(
                emptyPage({
                    connections: [{ family: "claude", last_used_at: "2026-11-21T10:44:00Z" }],
                })
            )
        );
        renderAt(
            "/workspace/tasks?view=agent&agent=chatgpt",
            <AgentActivityTab projects={projects} />
        );
        expect(await screen.findByText("Nothing matches these filters.")).toBeTruthy();
        const empty = screen
            .getByText("Nothing matches these filters.")
            .closest("[data-empty]") as HTMLElement;
        fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }));
        await waitFor(() => expect(sent(get.mock.calls.length - 1).agent).toBeUndefined());
    });

    it("sends the period in the request when the URL carries it", async () => {
        get.mockResolvedValueOnce(okWith(makePage()));
        renderAt(
            "/workspace/tasks?view=agent&period=31&project=2",
            <AgentActivityTab projects={projects} />
        );
        await screen.findByText("Pricing page copy");
        expect(sent(0)).toMatchObject({ days: "31", project_id: "2" });
    });

    it("on a phone the filters sit behind a Filters button that opens a sheet", async () => {
        mobileFlag.value = true;
        get.mockResolvedValueOnce(okWith(makePage()));
        renderAt("/workspace/tasks?view=agent", <AgentActivityTab projects={projects} />);
        await screen.findByText("Pricing page copy");
        const button = screen.getByRole("button", { name: "Filters" });
        expect(screen.queryByRole("group", { name: "Filters" })).toBeNull();
        fireEvent.click(button);
        const sheet = await screen.findByRole("dialog");
        expect(within(sheet).getByRole("combobox", { name: "Period" })).toBeTruthy();
        expect(within(sheet).getByRole("combobox", { name: "Kind of work" })).toBeTruthy();
    });

    it("keeps view=agent in the address bar while the tab is open", async () => {
        get.mockResolvedValueOnce(okWith(makePage()));
        let seen = "";
        const Probe = () => {
            const [params] = useSearchParams();
            seen = params.toString();
            return null;
        };
        render(
            <CssVarsProvider>
                <ThemeProvider theme={{ [THEME_ID]: createTheme({ cssVariables: true }) }}>
                    <MemoryRouter initialEntries={["/workspace/tasks"]}>
                        <Probe />
                        <Routes>
                            <Route
                                path="/workspace/tasks"
                                element={<AgentActivityTab projects={projects} />}
                            />
                        </Routes>
                    </MemoryRouter>
                </ThemeProvider>
            </CssVarsProvider>
        );
        await waitFor(() => expect(seen).toContain("view=agent"));
    });
});

describe("TaskDashboard tab strip", () => {
    const myself = {
        userId: "me",
        userName: "Me",
        teamId: "team1",
        teamName: "Team",
        userEmail: "me@test.com",
    };
    const baseProps = {
        myself,
        setMyself: vi.fn(),
        socket: null,
        onCloseTaskHome: vi.fn(),
        useTM: {
            allTasks: [],
            fetchProjectTasks: vi.fn(),
            isTaskPreviewVisible: false,
            isCreatingTask: { flag: false },
        },
        usePM: {
            currentProject: {
                projectId: 42,
                projectName: "Proj",
                isJoined: true,
                projectTags: [],
            },
            teamProjects: [{ projectId: 42, projectName: "Proj", isJoined: true }],
        },
        useSM: {
            projectSprints: {},
            currentSprint: null,
            projectMilestones: {},
            setCurrentSprint: vi.fn(),
        },
        useCM: { allChats: [] },
        useTEM: { teamMemberProfiles: {} },
        useUISM: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as any;

    it("adds an Agent Activity tab that opens the tab", async () => {
        get.mockRejectedValue(httpError(404));
        render(
            <CssVarsProvider>
                <ThemeProvider theme={{ [THEME_ID]: createTheme({ cssVariables: true }) }}>
                    <AvatarContextProvider
                        value={
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            {
                                myself,
                                setMyself: vi.fn(),
                                teamMemberProfiles: {},
                                setTeamMemberProfiles: vi.fn(),
                                socket: null,
                                useCM: { allChats: [] },
                                useUISM: {},
                            } as any
                        }
                    >
                        <MemoryRouter initialEntries={["/workspace/tasks"]}>
                            <Routes>
                                <Route
                                    path="/workspace/tasks"
                                    element={<TaskDashboard {...baseProps} />}
                                />
                            </Routes>
                        </MemoryRouter>
                    </AvatarContextProvider>
                </ThemeProvider>
            </CssVarsProvider>
        );
        const tab = await screen.findByRole("tab", { name: "Agent Activity" });
        fireEvent.click(tab);
        expect(await screen.findByTestId("agent-activity-tab")).toBeTruthy();
        expect(await screen.findByText("Agent activity is not available yet")).toBeTruthy();
    });
});
