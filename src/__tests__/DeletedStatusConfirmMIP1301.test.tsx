/**
 * MIP-1301: picking "Deleted" in a status picker asks first.
 *
 * The "Delete Task" menu item has a confirm; the status pickers (the preview's
 * ACTaskStatus, the table's status cell, the graph card's menu) used to be a way around
 * it. The working copy must not hold "Deleted" while the question is open, because every
 * autosave PUT carries `status`.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { ACTaskStatus } from "../features/tasks/components/autocompletes/ACTaskStatus";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import { TaskNodeView } from "../features/tasks/diagram/components/TaskNodeCard";
import type { TaskNodeData } from "../features/tasks/diagram/types";
import { isDeletingStatus } from "../features/tasks/utils/deletedStatus";
import { statuses } from "../features/tasks/utils/taskMeta";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/integrations/components/PrStatusCell", () => ({
    PrStatusCell: () => null,
}));

// Handles need a React Flow node to belong to.
vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    Handle: () => <i />,
}));

afterEach(cleanup);

const byName = (name: string) => statuses.find((s) => s.status === name)!;

describe("isDeletingStatus", () => {
    it("asks only for a CHANGE to Deleted", () => {
        expect(isDeletingStatus("Deleted", "Open")).toBe(true);
        expect(isDeletingStatus("Deleted", undefined)).toBe(true);
        expect(isDeletingStatus("Deleted", "Deleted")).toBe(false);
        expect(isDeletingStatus("Open", "Deleted")).toBe(false);
        expect(isDeletingStatus("Closed", "Open")).toBe(false);
    });
});

describe("the preview's status picker", () => {
    const setup = (over: object = {}, withHandler = true) => {
        const setTaskContent = vi.fn();
        const setTaskStatusUpdated = vi.fn();
        const setTaskUpdated = vi.fn();
        const onDeleteTask = vi.fn();
        render(
            <CssVarsProvider>
                <ACTaskStatus
                    setTaskContent={setTaskContent}
                    setTaskStatusUpdated={setTaskStatusUpdated}
                    setTaskUpdated={setTaskUpdated}
                    socket={null}
                    taskContent={
                        { id: "1", title: "Ship it", status: byName("Open"), ...over } as never
                    }
                    onDeleteTask={withHandler ? onDeleteTask : undefined}
                />
            </CssVarsProvider>
        );
        return { setTaskContent, setTaskStatusUpdated, setTaskUpdated, onDeleteTask };
    };
    const open = () => {
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: "ArrowDown" });
    };
    const choose = (name: string) => {
        open();
        const option = screen.getAllByRole("option").find((o) => o.textContent?.includes(name))!;
        fireEvent.click(option);
    };

    it("Deleted goes to the delete handler and NEVER into the working copy or the autosave flags (MIP-1168)", () => {
        const { setTaskContent, setTaskStatusUpdated, setTaskUpdated, onDeleteTask } = setup();
        choose("Deleted");
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(onDeleteTask).toHaveBeenCalledTimes(1);
        // Every autosave PUT carries `status`: the copy must not hold Deleted.
        expect(setTaskContent).not.toHaveBeenCalled();
        expect(setTaskStatusUpdated).not.toHaveBeenCalled();
        expect(setTaskUpdated).not.toHaveBeenCalled();
    });

    it("any other status applies at once, with no dialog", () => {
        const { setTaskContent, setTaskUpdated, onDeleteTask } = setup();
        choose("WIP");
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(setTaskContent.mock.calls[0][0].status.status).toBe("WIP");
        expect(setTaskUpdated).toHaveBeenCalledWith(true);
        expect(onDeleteTask).not.toHaveBeenCalled();
    });

    it("leaving Deleted (bringing a task back) is an ordinary pick", () => {
        const { setTaskContent, onDeleteTask } = setup({ status: byName("Deleted") });
        choose("Open");
        expect(setTaskContent.mock.calls[0][0].status.status).toBe("Open");
        expect(onDeleteTask).not.toHaveBeenCalled();
    });

    it("without a handler the Deleted option is not offered", () => {
        setup({}, false);
        open();
        const names = screen.getAllByRole("option").map((o) => o.textContent);
        expect(names.some((n) => n?.includes("Deleted"))).toBe(false);
        expect(names.some((n) => n?.includes("WIP"))).toBe(true);
    });
});

describe("the table's status cell", () => {
    const me = { userId: "u1", userName: "Ken", teamId: "t1" } as unknown as UserProps;
    const columns = defaultColumns
        .filter((c) => !c.hidden)
        .map((c) => ({ ...c, width: c.width || 100 }));
    const useTM = {
        isTaskPreviewVisible: false,
        currentPreviewKind: "task",
        currentPreviewTaskId: -1,
        currentPreviewMilestoneId: -1,
    } as unknown as TaskManagementState;
    const task = {
        id: "1",
        displayId: "PRJ-1",
        title: "Task 1",
        status: "Open",
        priority: "High",
        effortLevel: "Medium",
        parentTaskId: null,
        rootTaskId: 1,
        projectId: 1,
        tags: [],
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
    } as unknown as TaskTableProps;

    const renderRow = () => {
        const onRowUpdate = vi.fn(async (t: TaskTableProps) => t);
        const onDeleteTask = vi.fn();
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
                                            onDeleteTask={onDeleteTask}
                                            onRequestPreview={vi.fn()}
                                            onRowUpdate={onRowUpdate}
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
        return { onRowUpdate, onDeleteTask };
    };
    const pick = (name: string) => {
        // The status cell is the button that shows the current status's word.
        const cell = screen
            .getAllByRole("button")
            .find((b) => b.getAttribute("data-status") === "Open" || b.textContent === "Open")!;
        fireEvent.click(cell);
        fireEvent.click(screen.getByRole("option", { name: new RegExp(name) }));
    };

    it("Deleted goes to the delete handler (an Undo toast), not to the save and not to a dialog", () => {
        const { onRowUpdate, onDeleteTask } = renderRow();
        pick("Deleted");
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(onDeleteTask).toHaveBeenCalledTimes(1);
        expect(onDeleteTask.mock.calls[0][0].id).toBe("1");
        // The row keeps its status until the delete is committed.
        expect(onRowUpdate).not.toHaveBeenCalled();
    });

    it("another status is sent straight away", async () => {
        const { onRowUpdate, onDeleteTask } = renderRow();
        pick("Closed");
        expect(screen.queryByRole("alertdialog")).toBeNull();
        await waitFor(() => expect(onRowUpdate).toHaveBeenCalledTimes(1));
        expect(onRowUpdate.mock.calls[0][0].status).toBe("Closed");
        expect(onDeleteTask).not.toHaveBeenCalled();
    });
});

describe("the graph card's status menu", () => {
    const renderCard = () => {
        const onChange = vi.fn();
        const data = {
            task: {
                id: 7,
                displayId: "MIP-7",
                title: "Node title",
                status: "Open",
                priority: null,
                assigneeId: null,
                assigneeName: "",
                startDate: null,
                dueDate: null,
                isMilestone: false,
            },
            isRoot: false,
            isCurrentPreview: false,
            isNewlyCreated: false,
            isAssignedToViewer: false,
            isExternal: false,
            openBlockerCount: 0,
            projectName: "",
            onChange,
            onAddSubtask: vi.fn(),
            onOpenPreview: vi.fn(),
        } as unknown as TaskNodeData;
        render(
            <AvatarContextProvider
                value={{
                    myself: { userId: "me", userName: "Me" } as unknown as UserProps,
                    setMyself: () => {},
                    teamMemberProfiles: {},
                    setTeamMemberProfiles: () => {},
                    socket: null,
                    useCM: {} as never,
                    useUISM: {} as never,
                }}
            >
                <CssVarsProvider>
                    <TaskNodeView data={data} />
                </CssVarsProvider>
            </AvatarContextProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: /Open/ }));
        return onChange;
    };
    const pick = (name: string) =>
        fireEvent.click(
            screen.getAllByRole("menuitem").find((el) => within(el).queryByText(name))!
        );

    it("asks before Deleted and patches nothing on Cancel", async () => {
        const onChange = renderCard();
        pick("Deleted");
        const dialog = screen.getByRole("alertdialog");
        expect(within(dialog).getByText("Node title")).toBeTruthy();
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByText("Cancel"));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(onChange).not.toHaveBeenCalled();
    });

    it("patches the status once, on Confirm", async () => {
        const onChange = renderCard();
        pick("Deleted");
        fireEvent.click(within(screen.getByRole("alertdialog")).getByText("Delete"));
        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "Deleted" }));
    });

    it("another status patches at once", () => {
        const onChange = renderCard();
        pick("WIP");
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "WIP" }));
    });
});
