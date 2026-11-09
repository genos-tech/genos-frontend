/**
 * MIP-1366: the Activity tab of a task or milestone offers a second view, what
 * changed UNDER it, but only when something is under it: for a task with no
 * sub-tasks it would repeat the first.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskTabBlock } from "../features/tasks/components/contents/base/TaskTabBlock";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

vi.mock("../features/tasks/components/contents/base/sub/TaskCommentList", () => ({
    TaskCommentList: () => <div data-testid="comment-list" />,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskCommentEditorBlock", () => ({
    TaskCommentEditorBlock: () => <div data-testid="comment-editor" />,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskActivityFeed", () => ({
    TaskActivityFeed: () => <div data-testid="activity-feed" />,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskProgressFeed", () => ({
    TaskProgressFeed: (props: { taskId: number; version: string; projectId: number | null }) => (
        <div
            data-project={props.projectId}
            data-task={props.taskId}
            data-testid="progress-feed"
            data-version={props.version}
        />
    ),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../components/ui/feedback/useFileSizeGuard", () => ({
    useFileSizeGuard: () => ({
        rejection: null,
        dismissRejection: vi.fn(),
        filterFiles: (files: File[]) => files,
    }),
}));

afterEach(cleanup);

const content = (id: number) =>
    ({
        id,
        title: "Ship it",
        displayId: `GEN-${id}`,
        project: { projectId: 7, projectName: "Genos" },
        attachments: [],
    }) as unknown as TaskProps;

const row = (id: number, over: Partial<TaskTableProps> = {}) =>
    ({ id: String(id), parentTaskId: null, lastProgressAt: null, ...over }) as TaskTableProps;

const tree = (over: Partial<TaskTableProps> = {}) => [
    row(42, over),
    row(43, { parentTaskId: 42 as never }),
];

const tabs = (taskId: number, allTasks: TaskTableProps[]) => (
    <CssVarsProvider>
        <MemoryRouter>
            <UrlLinkModalProvider value={{ openModalByHref: vi.fn() }}>
                <TaskTabBlock
                    editTargetComment={undefined}
                    isInEdit={false}
                    isLoadingTaskActivities={false}
                    myself={{ userId: "u1", teamId: "t1" } as UserProps}
                    setEditTargetComment={vi.fn()}
                    setIsInEdit={vi.fn()}
                    setMyself={vi.fn()}
                    setTabIndex={vi.fn()}
                    setTaskCommentLines={vi.fn()}
                    setTaskComments={vi.fn()}
                    setTaskContent={vi.fn()}
                    setTaskUpdated={vi.fn()}
                    socket={null}
                    tabIndex={3}
                    taskActivities={[]}
                    taskCommentLines={0}
                    taskComments={[]}
                    taskContent={content(taskId)}
                    taskNotes={[]}
                    tmpCurrentTaskContent={content(taskId)}
                    useCM={{ allChats: [] } as unknown as ChatManagementState}
                    useNM={
                        {
                            tabsApi: { openTab: vi.fn() },
                            taskNoteMeta: [],
                            chatNoteMeta: [],
                            myNoteFolders: [],
                            teamNoteFolders: [],
                        } as unknown as NoteManagementState
                    }
                    useTEM={{} as unknown as TeamManagementState}
                    useTM={
                        {
                            allTasks,
                            setIsTaskTableVisible: vi.fn(),
                        } as unknown as TaskManagementState
                    }
                    useUISM={{} as unknown as UIStateManagementState}
                    onAttachmentDeleted={vi.fn()}
                />
            </UrlLinkModalProvider>
        </MemoryRouter>
    </CssVarsProvider>
);

describe("the Activity tab's two views", () => {
    it("is just the activity feed for a task with nothing under it", () => {
        render(tabs(42, [row(42)]));
        expect(screen.getByTestId("activity-feed")).toBeTruthy();
        expect(screen.queryByTestId("activity-scope-under")).toBeNull();
        expect(screen.queryByTestId("progress-feed")).toBeNull();
    });

    it("is not fooled by a task that is only somebody else's parent", () => {
        render(tabs(43, tree()));
        expect(screen.queryByTestId("activity-scope-under")).toBeNull();
    });

    it("offers 'Under it' when there are sub-tasks, starting on the task's own changes", () => {
        render(tabs(42, tree()));
        expect(screen.getByTestId("activity-scope-own").getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByTestId("activity-feed")).toBeTruthy();
        expect(screen.queryByTestId("progress-feed")).toBeNull();
    });

    it("switches to the progress feed, with the task's lastProgressAt as its version, and back", () => {
        render(tabs(42, tree({ lastProgressAt: "2026-11-09 10:00:00+00:00" })));
        fireEvent.click(screen.getByTestId("activity-scope-under"));
        const feed = screen.getByTestId("progress-feed");
        expect(feed.getAttribute("data-task")).toBe("42");
        expect(feed.getAttribute("data-project")).toBe("7");
        expect(feed.getAttribute("data-version")).toBe("2026-11-09 10:00:00+00:00");
        expect(screen.queryByTestId("activity-feed")).toBeNull();

        fireEvent.click(screen.getByTestId("activity-scope-own"));
        expect(screen.getByTestId("activity-feed")).toBeTruthy();
        expect(screen.queryByTestId("progress-feed")).toBeNull();
    });

    it("hands the feed a changed lastProgressAt when a sub-task moves", () => {
        const view = render(tabs(42, tree({ lastProgressAt: "v1" })));
        fireEvent.click(screen.getByTestId("activity-scope-under"));
        view.rerender(tabs(42, tree({ lastProgressAt: "v2" })));
        expect(screen.getByTestId("progress-feed").getAttribute("data-version")).toBe("v2");
    });

    it("goes back to the task's own changes when a different task is opened", () => {
        const all = [...tree(), row(50), row(51, { parentTaskId: 50 as never })];
        const view = render(tabs(42, all));
        fireEvent.click(screen.getByTestId("activity-scope-under"));
        view.rerender(tabs(50, all));
        expect(screen.getByTestId("activity-scope-own").getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByTestId("activity-feed")).toBeTruthy();
    });

    it("falls back to the activity feed if the sub-tasks go away while 'Under it' is selected", () => {
        const view = render(tabs(42, tree()));
        fireEvent.click(screen.getByTestId("activity-scope-under"));
        view.rerender(tabs(42, [row(42)]));
        expect(screen.getByTestId("activity-feed")).toBeTruthy();
        expect(screen.queryByTestId("progress-feed")).toBeNull();
    });
});
