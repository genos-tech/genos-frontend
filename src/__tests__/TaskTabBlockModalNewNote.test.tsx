// TaskTabBlock Notes tab — the "New Note" button in the modal-hosted
// task preview. It used to be hidden there (creation drove the
// notes-page state behind the dialog — a dead click); now it creates
// the note with `skipOpenTab` and re-targets the hosting UrlLinkModal
// to the new note, same as clicking an existing note row.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { TaskTabBlock } from "../features/tasks/components/contents/base/TaskTabBlock";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

// The comment list/editor and activity feed transitively import the
// BlockNote stack — stub them; the Notes tab under test doesn't use them.
vi.mock("../features/tasks/components/contents/base/sub/TaskCommentList", () => ({
    TaskCommentList: () => <div data-testid="comment-list" />,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskCommentEditorBlock", () => ({
    TaskCommentEditorBlock: () => <div data-testid="comment-editor" />,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskActivityFeed", () => ({
    TaskActivityFeed: () => <div data-testid="activity-feed" />,
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../components/ui/feedback/useFileSizeGuard", () => ({
    useFileSizeGuard: () => ({
        rejection: null,
        dismissRejection: vi.fn(),
        filterFiles: (files: File[]) => files,
    }),
}));

const taskContent = {
    id: 42,
    title: "Ship it",
    displayId: "GEN-42",
    project: { projectId: 7, projectName: "Genos" },
    attachments: [],
} as unknown as TaskProps;

const renderBlock = ({
    hostZIndex,
    handleCreateNewTaskNote,
    setIsTaskNoteVisible,
    openModalByHref,
}: {
    hostZIndex?: number;
    handleCreateNewTaskNote: ReturnType<typeof vi.fn>;
    setIsTaskNoteVisible: ReturnType<typeof vi.fn>;
    openModalByHref: ReturnType<typeof vi.fn>;
}) => {
    const useNM = {
        handleCreateNewTaskNote,
        setIsTaskNoteVisible,
        tabsApi: { openTab: vi.fn() },
    } as unknown as NoteManagementState;
    const useTM = {
        setIsTaskTableVisible: vi.fn(),
        allTasks: [],
    } as unknown as TaskManagementState;

    render(
        <CssVarsProvider>
            <MemoryRouter>
                <UrlLinkModalProvider value={{ openModalByHref }}>
                    <TaskTabBlock
                        editTargetComment={undefined}
                        hostZIndex={hostZIndex}
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
                        tabIndex={1}
                        taskActivities={[]}
                        taskCommentLines={0}
                        taskComments={[]}
                        taskContent={taskContent}
                        taskNotes={[]}
                        tmpCurrentTaskContent={taskContent}
                        useCM={{ allChats: [] } as unknown as ChatManagementState}
                        useNM={useNM}
                        useTEM={{} as unknown as TeamManagementState}
                        useTM={useTM}
                        useUISM={{} as unknown as UIStateManagementState}
                        onAttachmentDeleted={vi.fn()}
                    />
                </UrlLinkModalProvider>
            </MemoryRouter>
        </CssVarsProvider>
    );
    return { useTM };
};

describe("TaskTabBlock — New Note in the modal-hosted preview", () => {
    it("creates with skipOpenTab and re-targets the hosting modal", async () => {
        const handleCreateNewTaskNote = vi
            .fn()
            .mockResolvedValue({ noteType: 2, noteId: 99, projectId: 7, taskId: 42 });
        const setIsTaskNoteVisible = vi.fn();
        const openModalByHref = vi.fn().mockReturnValue("opened");

        renderBlock({
            hostZIndex: 10020,
            handleCreateNewTaskNote,
            setIsTaskNoteVisible,
            openModalByHref,
        });

        fireEvent.click(screen.getByText("New Note"));

        await waitFor(() =>
            expect(openModalByHref).toHaveBeenCalledWith(
                "/workspace/notes/task/project/7/task/42/note/99"
            )
        );
        expect(handleCreateNewTaskNote).toHaveBeenCalledWith(null, 7, 42, "Ship it", {
            skipOpenTab: true,
        });
        // The notes-page surface behind the dialog must stay untouched.
        expect(setIsTaskNoteVisible).not.toHaveBeenCalled();
    });

    it("keeps the page-hosted flow: opens the notes page editor", async () => {
        const handleCreateNewTaskNote = vi
            .fn()
            .mockResolvedValue({ noteType: 2, noteId: 99, projectId: 7, taskId: 42 });
        const setIsTaskNoteVisible = vi.fn();
        const openModalByHref = vi.fn();

        renderBlock({ handleCreateNewTaskNote, setIsTaskNoteVisible, openModalByHref });

        fireEvent.click(screen.getByText("New Note"));

        await waitFor(() =>
            expect(handleCreateNewTaskNote).toHaveBeenCalledWith(null, 7, 42, "Ship it")
        );
        expect(setIsTaskNoteVisible).toHaveBeenCalledWith(true);
        expect(openModalByHref).not.toHaveBeenCalled();
    });
});
