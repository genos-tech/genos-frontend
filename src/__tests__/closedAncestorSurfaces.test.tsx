/**
 * MIP-1389: the surfaces that list or bucket tasks read a task under a Closed or
 * Deleted ancestor as Closed or Deleted, whatever its own row says.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { SprintBoardCard } from "../features/tasks/components/board/SprintBoardCard";
import { MobileTaskList } from "../features/tasks/MobileTaskList";
import { bucketBoardColumns } from "../features/tasks/utils/sprintBoardDisplay";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

const task = (over: Partial<TaskTableProps>): TaskTableProps =>
    ({
        id: "1",
        title: "Row",
        status: "Open",
        tags: [],
        projectId: 1,
        parentTaskId: null,
        isMilestone: false,
        ...over,
    }) as unknown as TaskTableProps;

const withContext = (node: React.ReactNode) => (
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
        <CssVarsProvider>{node}</CssVarsProvider>
    </AvatarContextProvider>
);

describe("the phone task list", () => {
    it("hides a task whose milestone is Closed or Deleted, whatever its own status", () => {
        render(
            withContext(
                <MobileTaskList
                    usePM={{ currentProject: { projectId: 1 } } as never}
                    useTM={
                        {
                            allTasks: [
                                task({ id: "10", title: "Live", milestoneId: 1 }),
                                task({
                                    id: "70",
                                    title: "Closed milestone",
                                    status: "Closed",
                                    isMilestone: true,
                                    milestoneId: 7,
                                }),
                                task({ id: "11", title: "In the closed one", milestoneId: 7 }),
                                task({
                                    id: "80",
                                    title: "Deleted milestone",
                                    status: "Deleted",
                                    isMilestone: true,
                                    milestoneId: 8,
                                }),
                                task({ id: "12", title: "In the deleted one", milestoneId: 8 }),
                                task({
                                    id: "71",
                                    title: "Open milestone",
                                    isMilestone: true,
                                    milestoneId: 1,
                                }),
                            ],
                            setCurrentPreviewTaskId: vi.fn(),
                            setIsTaskPreviewVisible: vi.fn(),
                        } as never
                    }
                />
            )
        );
        expect(screen.getByText("Live")).toBeTruthy();
        expect(screen.getByText("Open milestone")).toBeTruthy();
        for (const hidden of [
            "Closed milestone",
            "In the closed one",
            "Deleted milestone",
            "In the deleted one",
        ]) {
            expect(screen.queryByText(hidden)).toBeNull();
        }
    });
});

describe("the board's columns", () => {
    const rows = [
        task({ id: "1", status: "Closed" }),
        task({ id: "2", status: "Open", parentTaskId: "1" }),
        task({ id: "3", status: "WIP", parentTaskId: "2" }),
        task({ id: "4", status: "Deleted" }),
        task({ id: "5", status: "Open", parentTaskId: "4" }),
        task({ id: "6", status: "Blocked" }),
        task({ id: "7", status: null as unknown as string }),
    ];

    it("puts a card under a Closed ancestor in Closed and leaves a Deleted branch out", () => {
        const columns = bucketBoardColumns(rows, rows);
        const ids = (key: keyof typeof columns) => columns[key].map((t) => String(t.id));
        expect(ids("closed")).toEqual(["1", "2", "3"]);
        expect(ids("open")).toEqual(["7"]);
        expect(ids("blocked")).toEqual(["6"]);
        expect(ids("wip")).toEqual([]);
        expect(columns.pending).toEqual([]);
    });

    it("looks the ancestors up in the whole list, not in the cards drawn", () => {
        // The Closed parent is filtered off the board; its child is still Closed.
        const columns = bucketBoardColumns([rows[1]], rows);
        expect(columns.closed.map((t) => t.id)).toEqual(["2"]);
        expect(columns.open).toEqual([]);
    });

    it("a card in the Closed column has no due badge, even when its own status is Open", () => {
        const card = (inClosedColumn: boolean) =>
            render(
                withContext(
                    <DragDropContext onDragEnd={() => {}}>
                        <Droppable droppableId="col">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    <SprintBoardCard
                                        index={0}
                                        inClosedColumn={inClosedColumn}
                                        myself={{} as UserProps}
                                        task={task({ id: "2", dueDate: "2030-01-15" })}
                                        teamMemberProfiles={{}}
                                    />
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                )
            );
        const open = card(false);
        const withDue = open.container.textContent ?? "";
        open.unmount();
        const closed = card(true);
        expect(withDue.length).toBeGreaterThan((closed.container.textContent ?? "").length);
    });
});
