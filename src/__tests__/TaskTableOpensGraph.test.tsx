/**
 * The task table opens the right graph for the row that asked (MIP-1094).
 *
 * A top-level row (root task / milestone) opens its whole tree. A nested row opens
 * the graph of just that task and its subtasks. The row says which in the second
 * argument of `onOpenDiagram`; the table must hand it to the shared diagram with the
 * row's own id as the anchor.
 *
 * The table is rendered for real. The drag library, the rows (which hand the test
 * `onOpenDiagram`) and the diagram (which shows the test what it was given) are
 * stubs.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DraggableTaskTable } from "../features/tasks/components/table/DraggableTaskTable";
import type { TaskGraphScope } from "../features/tasks/diagram/types";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

vi.mock("@hello-pangea/dnd", () => ({
    DragDropContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Droppable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({ droppableProps: {}, innerRef: () => {}, placeholder: null }, {})}</>
    ),
    Draggable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({}, {})}</>
    ),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

let openDiagram: (task: TaskTableProps, scope: TaskGraphScope) => void = () => {};
vi.mock("../features/tasks/components/table/TaskTableRows", () => ({
    TaskTableRows: ({
        displayRows,
        onOpenDiagram,
    }: {
        displayRows: TaskTableProps[];
        onOpenDiagram: (task: TaskTableProps, scope: TaskGraphScope) => void;
    }) => {
        openDiagram = onOpenDiagram;
        return (
            <div>
                {displayRows.map((r) => (
                    <span key={r.id} data-testid={`row-${r.id}`} />
                ))}
            </div>
        );
    },
}));
vi.mock("../features/tasks/components/table/TaskFilterMenu", async () => {
    const React = await import("react");
    return {
        TaskFilterMenu: ({
            useTM,
            setCurrentDisplayingTasks,
        }: {
            useTM: { allTasks: TaskTableProps[] };
            setCurrentDisplayingTasks: (rows: TaskTableProps[]) => void;
        }) => {
            React.useEffect(() => {
                setCurrentDisplayingTasks(useTM.allTasks);
            }, [useTM.allTasks, setCurrentDisplayingTasks]);
            return null;
        },
    };
});
vi.mock("../features/tasks/components/table/TaskTableColumnSettings", () => ({
    TaskTableColumnSettings: () => null,
}));

type DiagramProps = {
    open: boolean;
    rootTaskId: number;
    scope?: TaskGraphScope;
    projectId: number;
    rootLabel: string;
    onClose: () => void;
};
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: (props: DiagramProps) => (
        <div
            data-label={props.rootLabel}
            data-project={props.projectId}
            data-root={props.rootTaskId}
            data-scope={props.scope ?? ""}
            data-testid="diagram"
        >
            <button onClick={props.onClose}>close diagram</button>
        </div>
    ),
}));
vi.mock("../hooks/tasks/useProjectCustomFields", () => ({
    useProjectCustomFields: () => ({ fields: [] }),
}));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn().mockResolvedValue([]),
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;

const makeRow = (id: string, extra: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id,
        displayId: `KDS-${id}`,
        title: `Task ${id}`,
        status: "Open",
        priority: "Medium",
        effortLevel: "Medium",
        dueDate: "",
        projectId: 1,
        parentTaskId: null,
        rootTaskId: Number(id),
        milestoneId: null,
        sprintId: null,
        isMilestone: false,
        assigneeId: "u1",
        tags: [],
        ...extra,
    }) as unknown as TaskTableProps;

const ROWS = [makeRow("42"), makeRow("43", { parentTaskId: "42" })];

const renderTable = async () => {
    const useTM = {
        allTasks: ROWS,
        setAllTasks: vi.fn(),
        tableMilestoneFilterId: null,
        currentPreviewTaskId: -1,
        currentPreviewMilestoneId: -1,
        currentPreviewKind: "task",
        currentPreviewTask: null,
        setCurrentPreviewTask: vi.fn(),
        syncPreviewEdit: vi.fn(),
        isLoadingTasks: false,
    };
    render(
        <CssVarsProvider>
            <DraggableTaskTable
                myself={myself}
                setMyself={vi.fn()}
                setTeamMembers={vi.fn()}
                socket={null}
                teamMembers={[]}
                useCM={{} as never}
                usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
                useSM={{ projectSprints: {} } as never}
                useTEM={{} as never}
                useTM={useTM as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );
    await waitFor(() => expect(screen.queryByTestId("row-42")).not.toBeNull());
};

describe("the task table's graph", () => {
    it("shows no graph until a row asks for one", async () => {
        await renderTable();

        expect(screen.queryByTestId("diagram")).toBeNull();
    });

    it("a top-level row opens its whole tree, anchored on the row", async () => {
        await renderTable();

        act(() => openDiagram(ROWS[0], "tree"));

        const diagram = screen.getByTestId("diagram");
        expect(diagram.getAttribute("data-scope")).toBe("tree");
        expect(diagram.getAttribute("data-root")).toBe("42");
        expect(diagram.getAttribute("data-project")).toBe("1");
        expect(diagram.getAttribute("data-label")).toBe("KDS-42 · Task 42");
    });

    it("a nested row opens just that task and its subtasks", async () => {
        await renderTable();

        act(() => openDiagram(ROWS[1], "task"));

        const diagram = screen.getByTestId("diagram");
        expect(diagram.getAttribute("data-scope")).toBe("task");
        expect(diagram.getAttribute("data-root")).toBe("43");
    });

    it("the next graph does not inherit the last one's scope", async () => {
        await renderTable();

        act(() => openDiagram(ROWS[1], "task"));
        act(() => screen.getByText("close diagram").click());
        expect(screen.queryByTestId("diagram")).toBeNull();
        act(() => openDiagram(ROWS[0], "tree"));

        expect(screen.getByTestId("diagram").getAttribute("data-scope")).toBe("tree");
    });
});
