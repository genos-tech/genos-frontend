/**
 * Task page, note pane: closing the last note tab used to leave the pane
 * behind as an empty resizable column. `TaskHomeLayout` gated the pane on
 * `useNM.isTaskNoteVisible` — an intent flag that nothing clears on close
 * — while every branch INSIDE the pane is gated on the matching
 * `current*Note`, all of which the active-tab sync effect nulls when the
 * strip empties (`useNoteManagement`: `if (!active) { setCurrentMyNote(null)
 * … }`). Result: a mounted `<Panel>` with nothing in it, and no way to
 * dismiss it — the close button the user would reach for lives in the note
 * header, inside the branch that didn't render.
 *
 * These tests assert on which PANELS the layout mounts, which is the part
 * the fix changes; the panel library and every heavy child are stubbed.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isNotePaneVisible } from "../features/notes/common/utils/notePaneVisibility";
import { TaskHomeLayout } from "../features/tasks/components/layout/TaskHomeLayout";

vi.mock("react-resizable-panels", () => ({
    Panel: ({ id, children }: { id: string; children?: React.ReactNode }) => (
        <div data-panel-id={id}>{children}</div>
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

// The note pane is panel 7; the task preview it sits next to is panel 3.
const NOTE_PANEL = '[data-panel-id="7"]';
const PREVIEW_PANEL = '[data-panel-id="3"]';

const taskNote = { noteId: 4, noteType: 2, projectId: 1, taskId: 2, title: "Sprint Retro" };

/**
 * @param openTabs how many note tabs the strip holds. Zero is the state
 *   after the user closes the last one — note that `isTaskNoteVisible`
 *   stays true and the breadcrumb chain stays populated, which is why the
 *   old gate still passed.
 */
const renderLayout = (openTabs: number) => {
    const tabs = Array.from({ length: openTabs }, (_, i) => ({
        id: `task-${taskNote.noteId + i}`,
        kind: "task",
        noteId: taskNote.noteId + i,
        title: taskNote.title,
    }));
    const useNM = {
        // Derived exactly as `useNoteManagement` does it, off the same
        // predicate — the pane is wanted (`isTaskNoteVisible`) but only
        // shown when the strip has something in it.
        isTaskNotePaneVisible: isNotePaneVisible({
            isVisible: true,
            hasOpenNote: tabs.length > 0,
        }),
        isTaskNoteVisible: true,
        tabsApi: { tabs },
        tabItems: tabs.map(() => ({ noteType: 2, noteId: taskNote.noteId })),
        selectedTabIndex: 0,
        currentNoteType: 2,
        currentTaskNoteChain: [{ noteId: taskNote.noteId, noteType: 2 }],
        currentTaskNote: tabs.length > 0 ? taskNote : null,
        currentMyNote: null,
        currentChatNote: null,
    };
    const useTM = {
        isCreatingTask: { flag: false },
        isSprintBoardVisible: false,
        isTaskDashboardVisible: false,
        isTaskPreviewVisible: true,
        isTaskTableVisible: false,
        currentPreviewKind: "task",
        currentPreviewTask: { id: 2 },
        currentPreviewTaskId: 2,
    };
    const usePM = { currentProject: { projectId: 1, projectName: "P" } };

    return render(
        <CssVarsProvider>
            <TaskHomeLayout
                myself={{ teamId: "team-1", userId: "u1" } as never}
                setMyself={() => {}}
                setOpenJoinProject={() => {}}
                socket={null}
                useCM={{} as never}
                useNM={useNM as never}
                usePM={usePM as never}
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
};

describe("task page note pane", () => {
    it("mounts the note pane while a note tab is open", () => {
        const { container, getByText } = renderLayout(1);

        expect(container.querySelector(NOTE_PANEL)).not.toBeNull();
        expect(getByText("task note editor")).toBeTruthy();
    });

    it("drops the note pane entirely once the last tab is closed", () => {
        const { container } = renderLayout(0);

        // THE BUG: this panel used to survive as an empty column the user
        // could neither fill nor close.
        expect(container.querySelector(NOTE_PANEL)).toBeNull();
        // ...and the pane it shares the page with is untouched, so the
        // task the user was reading stays on screen.
        expect(container.querySelector(PREVIEW_PANEL)).not.toBeNull();
    });

    it("never mounts the note pane empty", () => {
        // The real defect wasn't "a panel is present", it was "a panel is
        // present with nothing inside it". Pin that directly, so a future
        // gate that mounts the pane before its note resolves fails here.
        for (const openTabs of [0, 1]) {
            const { container, unmount } = renderLayout(openTabs);
            const pane = container.querySelector(NOTE_PANEL);
            if (pane) expect(pane.textContent).not.toBe("");
            unmount();
        }
    });
});
