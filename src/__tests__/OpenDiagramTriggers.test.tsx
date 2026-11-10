/**
 * "Open task graph" triggers on the task table row + sprint board card.
 *
 * Both surfaces host the trigger inside an element with its own click
 * behavior (the card's onClick opens the preview; the row's gutter sits
 * in a draggable), so the load-bearing contracts are:
 *   - on the board the trigger renders ONLY on root cards
 *     (`parentTaskId == null`);
 *   - in the table it renders on every root row, and on a nested row only when
 *     that row has subtasks (MIP-1094): a root row opens its whole tree, a
 *     nested row opens just that task and its subtasks;
 *   - clicking it calls `onOpenDiagram(task, scope)` WITHOUT also firing the
 *     host's own click action (card → preview).
 */

import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SprintBoardCard } from "../features/tasks/components/board/SprintBoardCard";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

const myself = { userId: "u1", teamId: "t1" } as unknown as UserProps;

const makeTask = (over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: "42",
        displayId: "PRJ-42",
        title: "Some task",
        status: "Open",
        assigneeId: null,
        assigneeName: null,
        parentTaskId: null,
        rootTaskId: null,
        projectId: 1,
        tags: [],
        daysLeft: 3,
        dueDate: "2026-07-20",
        isMilestone: false,
        milestoneId: null,
        ...over,
    }) as unknown as TaskTableProps;

// The row renders @mui/material components, which in production find
// their theme under THEME_ID (DraggableTaskTable's scoped ThemeProvider)
// — without it they'd resolve Joy's theme and crash on pxToRem.
const dnd = (ui: React.ReactNode) => (
    <CssVarsProvider>
        <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>
            <DragDropContext onDragEnd={() => {}}>
                <Droppable droppableId="test-drop">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                            {ui}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </ThemeProvider>
    </CssVarsProvider>
);

describe("DraggableTaskRow open-diagram trigger", () => {
    const renderRow = (depth: number, hasChildren = false) => {
        const onOpenDiagram = vi.fn();
        const useTM = {
            isTaskPreviewVisible: false,
            currentPreviewKind: "task",
            currentPreviewTaskId: -1,
            currentPreviewMilestoneId: -1,
        } as unknown as TaskManagementState;
        render(
            dnd(
                <DraggableTaskRow
                    columns={[]}
                    depth={depth}
                    expandedRows={new Set()}
                    hasChildren={hasChildren}
                    index={0}
                    isSelected={false}
                    mode="light"
                    myself={myself}
                    setMyself={vi.fn()}
                    socket={null}
                    task={makeTask()}
                    teamMembers={[]}
                    toggleExpand={vi.fn()}
                    useCM={{} as never}
                    useTEM={{} as never}
                    useTM={useTM}
                    useUISM={{} as never}
                    onOpenDiagram={onOpenDiagram}
                    onQuickAddChild={vi.fn()}
                    onRequestPreview={vi.fn()}
                    onRowUpdate={vi.fn()}
                />
            )
        );
        return { onOpenDiagram };
    };

    it("renders on a root row and reports the task", () => {
        const { onOpenDiagram } = renderRow(0);

        fireEvent.click(screen.getByRole("button", { name: "Open task graph" }));

        expect(onOpenDiagram).toHaveBeenCalledTimes(1);
        expect(onOpenDiagram.mock.calls[0][0].id).toBe("42");
    });

    it("a root row opens its whole tree, with or without subtasks", () => {
        for (const hasChildren of [false, true]) {
            const { onOpenDiagram } = renderRow(0, hasChildren);
            const buttons = screen.getAllByRole("button", { name: "Open task graph" });
            fireEvent.click(buttons[buttons.length - 1]);
            expect(onOpenDiagram.mock.calls[0][1]).toBe("tree");
        }
    });

    it("does not render on a sub-task row without subtasks", () => {
        renderRow(1);

        expect(screen.queryByRole("button", { name: "Open task graph" })).toBeNull();
    });

    it("renders on a sub-task row that has subtasks and opens just that task", () => {
        const { onOpenDiagram } = renderRow(1, true);

        fireEvent.click(screen.getByRole("button", { name: "Open task graph" }));

        expect(onOpenDiagram).toHaveBeenCalledTimes(1);
        expect(onOpenDiagram.mock.calls[0][0].id).toBe("42");
        expect(onOpenDiagram.mock.calls[0][1]).toBe("task");
    });

    it("a deeper sub-task row with subtasks opens just that task too", () => {
        const { onOpenDiagram } = renderRow(3, true);

        fireEvent.click(screen.getByRole("button", { name: "Open task graph" }));

        expect(onOpenDiagram.mock.calls[0][1]).toBe("task");
    });
});

describe("SprintBoardCard open-diagram trigger", () => {
    const renderCard = (task: TaskTableProps) => {
        const onOpenDiagram = vi.fn();
        const onTaskClick = vi.fn();
        render(
            dnd(
                <SprintBoardCard
                    columnId="open"
                    index={0}
                    myself={myself}
                    task={task}
                    teamMemberProfiles={{}}
                    onOpenDiagram={onOpenDiagram}
                    onTaskClick={onTaskClick}
                />
            )
        );
        return { onOpenDiagram, onTaskClick };
    };

    it("renders on a root card and does not also open the preview", () => {
        const { onOpenDiagram, onTaskClick } = renderCard(makeTask());

        fireEvent.click(screen.getByRole("button", { name: "Open task graph" }));

        expect(onOpenDiagram).toHaveBeenCalledTimes(1);
        expect(onOpenDiagram.mock.calls[0][0].id).toBe("42");
        expect(onTaskClick).not.toHaveBeenCalled();
    });

    it("card body click still opens the preview", () => {
        const { onOpenDiagram, onTaskClick } = renderCard(makeTask());

        fireEvent.click(screen.getByText("Some task"));

        expect(onTaskClick).toHaveBeenCalledTimes(1);
        expect(onOpenDiagram).not.toHaveBeenCalled();
    });

    it("does not render on a sub-task card", () => {
        renderCard(makeTask({ parentTaskId: "7" }));

        expect(screen.queryByRole("button", { name: "Open task graph" })).toBeNull();
    });
});
