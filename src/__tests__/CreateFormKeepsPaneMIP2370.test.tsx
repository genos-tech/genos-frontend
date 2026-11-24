/**
 * MIP-2370: submitting the create form must not close one pane and open another.
 *
 * With no preview on screen, the form takes the preview's slot; when the create
 * finishes, the SAME pane element swaps its content to the new item's preview.
 * With a preview already open (a sub-task made from it), the form keeps its own
 * pane beside the preview as before.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskHomeLayout } from "../features/tasks/components/layout/TaskHomeLayout";
import { useSoloCreatePane } from "../hooks/tasks/useSoloCreatePane";

vi.mock("react-resizable-panels", () => ({
    Panel: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
        <div data-testid={`panel-${id}`}>{children}</div>
    ),
    PanelGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/ui/ResizeHandle", () => ({ ResizeHandle: () => <div /> }));
vi.mock("../features/tasks/components/sidebar/TaskSidebarMain", () => ({
    TaskSidebar: () => <div>sidebar</div>,
}));
vi.mock("../features/tasks/components/contents/TaskPreview", () => ({
    TaskPreview: () => <div>task preview</div>,
}));
vi.mock("../features/tasks/components/contents/CreateTaskForm", () => ({
    CreateTaskForm: () => <div>create task form</div>,
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

type TMOverrides = {
    creating: boolean;
    previewVisible: boolean;
    kind?: "task" | "milestone";
};

const makeTM = ({ creating, previewVisible, kind = "task" }: TMOverrides) => ({
    isCreatingTask: { flag: creating },
    isSprintBoardVisible: false,
    isTaskDashboardVisible: false,
    isTaskPreviewVisible: previewVisible,
    isTaskTableVisible: true,
    currentPreviewKind: kind,
    currentPreviewTask: previewVisible && kind === "task" ? { id: 2 } : undefined,
    currentPreviewTaskId: previewVisible && kind === "task" ? 2 : -1,
});

const layout = (tm: ReturnType<typeof makeTM>) => (
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
            useTM={tm as never}
            useUISM={{} as never}
            isActiveRoute
            onCloseTaskHome={() => {}}
            onCreateProject={() => {}}
            onDeleteProject={() => {}}
            onManageTags={() => {}}
        />
    </CssVarsProvider>
);

describe("useSoloCreatePane", () => {
    it("is solo when the form opens with no preview, and holds through the submit", () => {
        const { result, rerender } = renderHook(
            ({ creating, preview }) => useSoloCreatePane(creating, preview),
            { initialProps: { creating: false, preview: false } }
        );
        expect(result.current).toBe(false);
        rerender({ creating: true, preview: false });
        expect(result.current).toBe(true);
        // The submit raises the preview flags before it lowers the creating flag.
        rerender({ creating: true, preview: true });
        expect(result.current).toBe(true);
        rerender({ creating: false, preview: true });
        expect(result.current).toBe(false);
    });

    it("is not solo when a preview is already open", () => {
        const { result, rerender } = renderHook(
            ({ creating, preview }) => useSoloCreatePane(creating, preview),
            { initialProps: { creating: false, preview: true } }
        );
        rerender({ creating: true, preview: true });
        expect(result.current).toBe(false);
    });
});

describe("TaskHomeLayout create form -> preview", () => {
    it("keeps the same pane element and swaps its content to the new task", () => {
        const { rerender } = render(layout(makeTM({ creating: true, previewVisible: false })));
        const pane = screen.getByTestId("panel-3");
        expect(pane).toHaveTextContent("create task form");
        expect(screen.queryByTestId("panel-4")).toBeNull();

        // Submit: preview flags up while the form is still there, then the form closes.
        rerender(layout(makeTM({ creating: true, previewVisible: true })));
        expect(screen.getByTestId("panel-3")).toBe(pane);
        expect(screen.queryByTestId("panel-4")).toBeNull();

        rerender(layout(makeTM({ creating: false, previewVisible: true })));
        expect(screen.getByTestId("panel-3")).toBe(pane);
        expect(pane).toHaveTextContent("task preview");
        expect(pane).not.toHaveTextContent("create task form");
    });

    it("does the same for a milestone", () => {
        const { rerender } = render(layout(makeTM({ creating: true, previewVisible: false })));
        const pane = screen.getByTestId("panel-3");
        rerender(layout(makeTM({ creating: false, previewVisible: true, kind: "milestone" })));
        expect(screen.getByTestId("panel-3")).toBe(pane);
        expect(pane).toHaveTextContent("task preview");
    });

    it("keeps the form beside an already-open preview", () => {
        render(layout(makeTM({ creating: true, previewVisible: true })));
        expect(screen.getByTestId("panel-3")).toHaveTextContent("task preview");
        expect(screen.getByTestId("panel-4")).toHaveTextContent("create task form");
    });
});
