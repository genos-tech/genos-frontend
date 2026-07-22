import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen } from "@testing-library/react";
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
