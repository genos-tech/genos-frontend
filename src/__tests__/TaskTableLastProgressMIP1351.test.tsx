/**
 * MIP-1351 / MIP-1362: the task table's "Last Progress" cell reads as an age
 * ("3 days ago"), and as "-" for a task the server has recorded none for.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/integrations/components/PrStatusCell", () => ({
    PrStatusCell: () => null,
}));

afterEach(cleanup);

const me = { userId: "u1", userName: "Ken", teamId: "t1" } as unknown as UserProps;
const columns = defaultColumns
    .filter((c) => c.field === "lastProgressAt")
    .map((c) => ({ ...c, width: c.width || 100 }));
const useTM = {
    isTaskPreviewVisible: false,
    currentPreviewKind: "task",
    currentPreviewTaskId: -1,
    currentPreviewMilestoneId: -1,
} as unknown as TaskManagementState;

const baseTask = {
    id: "1",
    displayId: "PRJ-1",
    title: "Task 1",
    status: "Open",
    priority: "High",
    effortLevel: "Medium",
    dueDate: "2026-12-01",
    assigneeId: "u-dan",
    assigneeName: "Dan OConnor",
    parentTaskId: null,
    rootTaskId: 1,
    projectId: 1,
    tags: [],
    isMilestone: false,
    milestoneId: null,
    sprintId: null,
} as unknown as TaskTableProps;

const renderRow = (task: TaskTableProps) =>
    render(
        <AvatarContextProvider
            value={{
                myself: me,
                setMyself: () => {},
                teamMemberProfiles: {},
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            <CssVarsProvider>
                <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>
                    <DragDropContext onDragEnd={() => {}}>
                        <Droppable droppableId="t">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    <DraggableTaskRow
                                        columns={columns}
                                        customFieldDefs={[]}
                                        depth={0}
                                        expandedRows={new Set()}
                                        hasChildren={false}
                                        index={0}
                                        isSelected={false}
                                        mode="light"
                                        myself={me}
                                        projectTags={[]}
                                        setMyself={vi.fn()}
                                        socket={null}
                                        task={task}
                                        teamMembers={[me]}
                                        toggleExpand={vi.fn()}
                                        useCM={{} as never}
                                        useTEM={{} as never}
                                        useTM={useTM}
                                        useUISM={{} as never}
                                        onOpenDiagram={vi.fn()}
                                        onQuickAddChild={vi.fn()}
                                        onRequestPreview={vi.fn()}
                                        onRowUpdate={vi.fn(async (t: TaskTableProps) => t)}
                                    />
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </ThemeProvider>
            </CssVarsProvider>
        </AvatarContextProvider>
    );

const withProgress = (lastProgressAt: string | null) =>
    ({ ...baseTask, lastProgressAt }) as unknown as TaskTableProps;

describe("the task table's Last Progress cell", () => {
    it("shows how long ago anything under the task moved", () => {
        renderRow(withProgress(new Date(Date.now() - 3 * 86_400_000).toISOString()));
        expect(screen.getByText("3 days ago")).toBeTruthy();
    });

    it("shows a dash when none is recorded", () => {
        renderRow(withProgress(null));
        expect(screen.getByText("-")).toBeTruthy();
    });

    it("understands the server's own time form", () => {
        const when = new Date(Date.now() - 2 * 3_600_000).toISOString();
        renderRow(withProgress(when.replace("T", " ").replace("Z", "+00:00")));
        expect(screen.getByText("2 hours ago")).toBeTruthy();
    });
});
