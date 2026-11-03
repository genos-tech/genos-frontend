/**
 * MIP-962: the task page opts into the switch loader. TaskHomeLayout is the
 * host for the table and the sprint board; it must pass `holdSwitchWithLoader`
 * to TaskPreview, and must NOT use chat's `guardStaleTaskId` (different
 * behaviour: unmounts the outgoing task, no delay, no failure release).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskHomeLayout } from "../features/tasks/components/layout/TaskHomeLayout";

const previewProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("react-resizable-panels", () => ({
    Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    PanelGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/ui/ResizeHandle", () => ({ ResizeHandle: () => <div /> }));
vi.mock("../features/tasks/components/sidebar/TaskSidebarMain", () => ({
    TaskSidebar: () => <div>sidebar</div>,
}));
vi.mock("../features/tasks/components/contents/TaskPreview", () => ({
    TaskPreview: (props: Record<string, unknown>) => {
        previewProps.current = props;
        return <div>task preview</div>;
    },
}));
vi.mock("../features/tasks/components/contents/CreateTaskForm", () => ({
    CreateTaskForm: () => <div>create task</div>,
}));
vi.mock("../features/tasks/components/dashboard/TaskDashboard", () => ({
    TaskDashboard: () => <div>dashboard</div>,
}));
vi.mock("../features/tasks/components/header/TaskHeader", () => ({
    TaskHeader: () => <div>header</div>,
}));
vi.mock("../features/tasks/components/table/DraggableTaskTable", () => ({
    DraggableTaskTable: () => <div>table</div>,
}));
vi.mock("../features/tasks/components/board", () => ({ SprintBoard: () => <div>board</div> }));
vi.mock("../features/notes/task-notes/components/TaskNoteMain", () => ({
    TaskNoteMain: () => <div>task note editor</div>,
}));
vi.mock("../features/notes/my-notes/components/MyNoteMain", () => ({
    MyNoteMain: () => <div>my note editor</div>,
}));
vi.mock("../features/notes/chat-notes/components/ChatNoteMain", () => ({
    ChatNoteMain: () => <div>chat note editor</div>,
}));

describe("TaskHomeLayout -> TaskPreview", () => {
    it("opts the task page into the switch loader", () => {
        const useNM = {
            isTaskNotePaneVisible: false,
            isTaskNoteVisible: false,
            tabsApi: { tabs: [] },
            tabItems: [],
            selectedTabIndex: 0,
            currentNoteType: 2,
            currentTaskNoteChain: [],
            currentTaskNote: null,
            currentMyNote: null,
            currentChatNote: null,
        };
        const useTM = {
            isCreatingTask: { flag: false },
            isSprintBoardVisible: false,
            isTaskDashboardVisible: false,
            isTaskPreviewVisible: true,
            isTaskTableVisible: true,
            currentPreviewKind: "task",
            currentPreviewTask: { id: 2 },
            currentPreviewTaskId: 2,
        };
        render(
            <CssVarsProvider>
                <TaskHomeLayout
                    myself={{ teamId: "team-1", userId: "u1" } as never}
                    setMyself={() => {}}
                    setOpenJoinProject={() => {}}
                    socket={null}
                    useCM={{} as never}
                    useNM={useNM as never}
                    usePM={{ currentProject: { projectId: 1 } } as never}
                    useSM={{} as never}
                    useTEM={{} as never}
                    useTM={useTM as never}
                    useUISM={{} as never}
                    isActiveRoute
                    onCloseTaskHome={() => {}}
                    onCreateProject={() => {}}
                    onCreateTag={() => {}}
                    onDeleteProject={() => {}}
                />
            </CssVarsProvider>
        );

        expect(previewProps.current).not.toBeNull();
        expect(previewProps.current?.holdSwitchWithLoader).toBe(true);
        expect(previewProps.current?.guardStaleTaskId).toBeUndefined();
    });
});
