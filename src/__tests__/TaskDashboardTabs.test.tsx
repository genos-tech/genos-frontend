import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { TaskDashboard } from "../features/tasks/components/dashboard/TaskDashboard";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

// TaskHomeContent reads the auth token (for the team-wide capacity fetch);
// stub it so the component mounts outside an AuthProvider. The team-wide
// fetch itself is stubbed empty so the capacity section just falls back to
// this project's numbers (all we assert here is the tabs + tag insights).
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn().mockResolvedValue([]),
}));

// Smoke test for the tabbed dashboard + Tag Insights. TaskHomeContent has no
// prior test coverage; the tabs (Joy Tabs/TabList/Tab) and the tag-stats table
// are the highest render-risk additions, so this mounts the real component with
// minimal hook-state stubs and drives the tab switch + tag aggregation.

const myself = {
    userId: "me",
    userName: "Me",
    teamId: "team1",
    teamName: "Team",
    userEmail: "me@test.com",
} as unknown as UserProps;

// Two tagged items: "backend" on both (one Open, one Closed) and "urgent" on
// the closed one. Assigned to someone else so "My Tasks" stays empty.
const tasks = [
    {
        id: "1",
        status: "Open",
        updatedAt: "2026-07-01",
        assigneeId: "other",
        priority: "High",
        dueDate: null,
        tags: [{ tagName: "backend", tagColor: "#3b82f6", tagTextColor: "white" }],
    },
    {
        id: "2",
        status: "Closed",
        updatedAt: "2026-07-02",
        assigneeId: "other",
        dueDate: null,
        tags: [
            { tagName: "backend", tagColor: "#3b82f6", tagTextColor: "white" },
            { tagName: "urgent", tagColor: "#ef4444", tagTextColor: "white" },
        ],
    },
] as unknown as TaskTableProps[];

const materialTheme = createTheme({ cssVariables: true });

const baseProps = {
    myself,
    setMyself: vi.fn(),
    socket: null,
    onCloseTaskHome: vi.fn(),
    useTM: {
        allTasks: tasks,
        fetchProjectTasks: vi.fn(),
        isTaskPreviewVisible: false,
        isCreatingTask: { flag: false },
    },
    usePM: {
        currentProject: { projectId: 42, projectName: "Proj", isJoined: true, projectTags: [] },
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

// The Team Capacity section renders <UserAvatar>, which subscribes to the
// AvatarContext that the authenticated shell (App.tsx) always provides.
// Mirror that here so the dashboard mounts as it does in production.
const avatarContextValue = {
    myself,
    setMyself: vi.fn(),
    teamMemberProfiles: {},
    setTeamMemberProfiles: vi.fn(),
    socket: null,
    useCM: { allChats: [] },
    useUISM: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as unknown as any;

const renderDashboard = () =>
    render(
        <CssVarsProvider>
            <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
                <AvatarContextProvider value={avatarContextValue}>
                    <TaskDashboard {...baseProps} />
                </AvatarContextProvider>
            </ThemeProvider>
        </CssVarsProvider>
    );

describe("TaskDashboard header (MIP-1220)", () => {
    it("shows its title in the shared page header, as the page's h1", () => {
        renderDashboard();
        const header = screen.getByTestId("task-dashboard-header");
        expect(within(header).getByRole("heading", { level: 1 }).textContent).toBe("Task Stats");
    });
});

describe("TaskDashboard tabs + Tag Insights", () => {
    it("renders the three section tabs", () => {
        renderDashboard();
        expect(screen.getByRole("tab", { name: /Overall Insights/ })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Sprint Insights/ })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /My Tasks/ })).toBeInTheDocument();
    });

    it("shows Tag Insights on the default Overall tab, aggregated by tag", () => {
        renderDashboard();
        expect(screen.getByText("Tag Insights")).toBeInTheDocument();
        // "backend" (2 items) is the most-used tag, so it renders in both the
        // summary tile and the table row; "urgent" (1 item) renders once.
        expect(screen.getAllByText("backend").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("urgent")).toBeInTheDocument();
        // Summary tiles present (coverage + tag count).
        expect(screen.getByText("Tags in use")).toBeInTheDocument();
        expect(screen.getByText("Tag coverage")).toBeInTheDocument();
    });

    it("switches away from Overall content when another tab is selected", () => {
        renderDashboard();
        expect(screen.getByText("Tag Insights")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("tab", { name: /My Tasks/ }));
        // Overall tab body (with Tag Insights) unmounts on switch.
        expect(screen.queryByText("Tag Insights")).not.toBeInTheDocument();
    });
});

// MIP-1004. "Assigned Milestones" lists ONGOING milestones only. The base set
// (`selectVisibleMilestones`) keeps Closed milestones that have no sprint or
// sit in an active/upcoming sprint (the sidebar's "Past milestones" and the
// filter menu need them), so the dashboard drops Closed on top of it.
describe("TaskDashboard Assigned Milestones (MIP-1004)", () => {
    const ACTIVE_SPRINT = 7;
    const milestoneFor = (
        id: number,
        title: string,
        status: string,
        assigneeId: string,
        sprintId: number | null = null
    ) =>
        ({
            milestoneId: id,
            taskId: 1000 + id,
            projectId: 42,
            teamId: "team1",
            sprintId,
            reporterId: null,
            title,
            description: [],
            status,
            statusCode: 0,
            priority: null,
            priorityCode: null,
            startDate: null,
            dueDate: null,
            tags: [],
            assignees: [{ userId: assigneeId, userName: assigneeId }],
            tasksTotal: 0,
            tasksClosed: 0,
            isDeleted: false,
        }) as unknown;

    const sprints = [
        {
            sprintId: ACTIVE_SPRINT,
            projectId: 42,
            teamId: "team1",
            name: "Sprint 7",
            sequenceNumber: 7,
            startDate: "2026-11-01",
            endDate: "2026-11-14",
            status: "active",
            isAutoGenerated: true,
            isDeleted: false,
            tsCreatedAt: "2026-11-01",
            tsUpdatedAt: "2026-11-01",
        },
    ];

    // A task for "other" only, so "other" is in the Member's Tasks picker and
    // "me" has no tasks of my own (milestone membership comes from assignees).
    const otherTasks = [
        {
            id: "1",
            status: "Open",
            updatedAt: "2026-11-01",
            assigneeId: "other",
            assigneeName: "Other Person",
            dueDate: null,
            tags: [],
        },
    ] as unknown as TaskTableProps[];

    const renderWith = (milestones: unknown[]) =>
        render(
            <CssVarsProvider>
                <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
                    <AvatarContextProvider value={avatarContextValue}>
                        <TaskDashboard
                            {...baseProps}
                            useTM={{ ...baseProps.useTM, allTasks: otherTasks }}
                            useSM={{
                                ...baseProps.useSM,
                                projectSprints: { 42: sprints },
                                projectMilestones: { 42: milestones },
                            }}
                        />
                    </AvatarContextProvider>
                </ThemeProvider>
            </CssVarsProvider>
        );

    // The count chip sits in the section header next to the title.
    const sectionCount = () => {
        const header = screen.getByText("Assigned Milestones").parentElement as HTMLElement;
        return within(header).queryByText(/^\d+$/)?.textContent ?? null;
    };

    it("shows Open milestones and hides Closed ones (no sprint, or in an active sprint)", () => {
        renderWith([
            milestoneFor(1, "Open MS", "Open", "me"),
            milestoneFor(2, "Closed no-sprint MS", "Closed", "me"),
            milestoneFor(3, "Closed active-sprint MS", "Closed", "me", ACTIVE_SPRINT),
        ]);
        fireEvent.click(screen.getByRole("tab", { name: /My Tasks/ }));

        expect(screen.getByText("Open MS")).toBeInTheDocument();
        expect(screen.queryByText("Closed no-sprint MS")).not.toBeInTheDocument();
        expect(screen.queryByText("Closed active-sprint MS")).not.toBeInTheDocument();
        expect(sectionCount()).toBe("1");
    });

    it("keeps Pending and Blocked milestones (only Closed counts as finished)", () => {
        renderWith([
            milestoneFor(1, "Pending MS", "Pending", "me"),
            milestoneFor(2, "Blocked MS", "Blocked", "me", ACTIVE_SPRINT),
            milestoneFor(3, "Closed MS", "Closed", "me"),
        ]);
        fireEvent.click(screen.getByRole("tab", { name: /My Tasks/ }));

        expect(screen.getByText("Pending MS")).toBeInTheDocument();
        expect(screen.getByText("Blocked MS")).toBeInTheDocument();
        expect(screen.queryByText("Closed MS")).not.toBeInTheDocument();
        expect(sectionCount()).toBe("2");
    });

    it("shows the 'nothing assigned' card when my only milestones are Closed and I have no tasks", () => {
        renderWith([
            milestoneFor(2, "Closed no-sprint MS", "Closed", "me"),
            milestoneFor(3, "Closed active-sprint MS", "Closed", "me", ACTIVE_SPRINT),
        ]);
        fireEvent.click(screen.getByRole("tab", { name: /My Tasks/ }));

        expect(screen.getByText("Nothing assigned to you yet")).toBeInTheDocument();
        expect(screen.queryByText("Assigned Milestones")).not.toBeInTheDocument();
        expect(screen.queryByText("Closed no-sprint MS")).not.toBeInTheDocument();
    });

    it("applies the same rule on the Member's Tasks tab", () => {
        renderWith([
            milestoneFor(1, "Other open MS", "Open", "other"),
            milestoneFor(2, "Other closed MS", "Closed", "other"),
            milestoneFor(3, "Other closed sprint MS", "Closed", "other", ACTIVE_SPRINT),
        ]);
        fireEvent.click(screen.getByRole("tab", { name: /Member's Tasks/ }));
        const input = screen.getByPlaceholderText("Search a member…");
        fireEvent.mouseDown(input);
        fireEvent.click(screen.getByRole("option", { name: /Other Person/ }));

        expect(screen.getByText("Other open MS")).toBeInTheDocument();
        expect(screen.queryByText("Other closed MS")).not.toBeInTheDocument();
        expect(screen.queryByText("Other closed sprint MS")).not.toBeInTheDocument();
        expect(sectionCount()).toBe("1");
    });
});
