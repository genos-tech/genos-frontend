/**
 * MIP-1768: on a phone in Japanese the task panel's tab strip (Comments, Notes,
 * Attachments, Activity) wrapped each label letter by letter and the strip grew
 * to about 90 px. Each tab shrank below its label because Joy's Tab is
 * `flex: initial` (`0 1 auto`). The strip now keeps every tab whole and scrolls
 * sideways when it does not fit, as the dashboard's tabs do.
 *
 * jsdom has no layout, so this pins the styles that make it so; the real
 * layout was looked at in a browser at 390 px (ja, en, ar, light and dark).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
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
                    taskActivitiesFailed={false}
                    taskCommentLines={0}
                    taskComments={[]}
                    taskContent={content(taskId)}
                    taskNotes={[]}
                    tmpCurrentTaskContent={content(taskId)}
                    useCM={{ allChats: [] } as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                    useNM={
                        {
                            tabsApi: { openTab: vi.fn() },
                            taskNoteMeta: [],
                            chatNoteMeta: [],
                            myNoteFolders: [],
                            teamNoteFolders: [],
                        } as unknown as NoteManagementState
                    }
                    useTM={
                        {
                            allTasks,
                            setIsTaskTableVisible: vi.fn(),
                        } as unknown as TaskManagementState
                    }
                    onAttachmentDeleted={vi.fn()}
                    onRetryTaskActivities={vi.fn()}
                />
            </UrlLinkModalProvider>
        </MemoryRouter>
    </CssVarsProvider>
);

const strip = () => {
    render(tabs(42, [row(42)]));
    return screen.getByRole("tablist");
};

describe("the task panel's tab strip", () => {
    it("scrolls sideways instead of wrapping", () => {
        const list = getComputedStyle(strip());
        expect(list.overflowX).toBe("auto");
        expect(list.flexWrap).toBe("nowrap");
    });

    it("never shrinks a tab below its label, and never breaks the label", () => {
        strip();
        const tabsInStrip = screen.getAllByRole("tab");
        // Four tabs, in Japanese as in English.
        expect(tabsInStrip.length).toBe(4);
        for (const tab of tabsInStrip) {
            const style = getComputedStyle(tab);
            expect(style.flexShrink, tab.textContent ?? "").toBe("0");
            expect(style.whiteSpace, tab.textContent ?? "").toBe("nowrap");
        }
    });
});
