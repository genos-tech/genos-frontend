/**
 * MIP-1755: in a preview modal a comment's own address is what Copy link gets, even when the page
 * behind is a project chat (there the page's own path is used), and the list knows it is in a modal.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskTabBlock } from "../features/tasks/components/contents/base/TaskTabBlock";
import { ModalCommentFocusContext } from "../features/tasks/context/modalCommentFocus";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

vi.mock("../features/tasks/components/contents/base/sub/TaskCommentList", () => ({
    TaskCommentList: (props: {
        commentLinkBuilder?: (id: number) => string;
        inModal?: boolean;
    }) => (
        <div
            data-in-modal={String(props.inModal)}
            data-link={props.commentLinkBuilder?.(41)}
            data-testid="comment-list"
        />
    ),
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
vi.mock("../context/authState", () => ({
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
                    tabIndex={0}
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

describe("a comment list over a project chat (MIP-1755)", () => {
    it.each([
        [true, "/workspace/tasks/project/7/task/42/comment/41", "true"],
        [false, "/workspace/chat/pm/c1", "false"],
    ])("in a modal: %s", (inModal, link, flag) => {
        window.history.pushState({}, "", "/workspace/chat/pm/c1");
        const view = tabs(42, [row(42)]);
        render(
            inModal ? (
                <ModalCommentFocusContext.Provider value={{ commentId: 41, taskId: 42 }}>
                    {view}
                </ModalCommentFocusContext.Provider>
            ) : (
                view
            )
        );

        const list = screen.getByTestId("comment-list");
        expect(list.getAttribute("data-link")).toBe(link);
        expect(list.getAttribute("data-in-modal")).toBe(flag);
    });
});
