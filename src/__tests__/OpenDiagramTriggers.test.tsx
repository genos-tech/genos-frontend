/**
 * "Open task graph" triggers on the task table row + sprint board card.
 *
 * Both surfaces host the trigger inside an element with its own click
 * behavior (the card's onClick opens the preview; the row's gutter sits
 * in a draggable), so the load-bearing contracts are:
 *   - the trigger renders ONLY on root rows/cards (depth 0 in the
 *     table, `parentTaskId == null` on the board) — sub-tasks reach
 *     their graph from the root and must not grow gutter/footer noise;
 *   - clicking it calls `onOpenDiagram(task)` WITHOUT also firing the
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
    const renderRow = (depth: number) => {
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
                    hasChildren={false}
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

    it("does not render on a sub-task row", () => {
        renderRow(1);

        expect(screen.queryByRole("button", { name: "Open task graph" })).toBeNull();
    });
});

describe("SprintBoardCard open-diagram trigger", () => {
    const renderCard = (task: TaskTableProps) => {
        const onOpenDiagram = vi.fn();
        const onTaskClick = vi.fn();
        render(
            dnd(
                <SprintBoardCard
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
