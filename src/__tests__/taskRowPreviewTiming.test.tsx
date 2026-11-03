/**
 * MIP-968: when a task row (table) or card (sprint board) starts loading its
 * preview.
 *
 * Both used to wait 150 ms after EVERY click before touching the preview
 * state, so an ordinary single click paid 150 ms of nothing. The wait is now
 * leading-edge: the first click starts the load at once, and only clicks that
 * follow another within 150 ms are collapsed (to the last one).
 *
 * The table and the board are rendered for real, with their rows / columns
 * replaced by stubs that hand the test the click handler and the "is this
 * selected" answer the real ones receive. The preview state is real React
 * state, so the highlight that follows the click is observed, not assumed.
 */
import { useMemo, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SprintBoard } from "../features/tasks/components/board/SprintBoard";
import { DraggableTaskTable } from "../features/tasks/components/table/DraggableTaskTable";
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

// What the table hands to its rows.
let requestPreview: (row: TaskTableProps) => void = () => {};
let isSelected: (row: TaskTableProps) => boolean = () => false;
// How often the screen re-rendered (its rows / columns are re-rendered with it).
let screenRenders = 0;
vi.mock("../features/tasks/components/table/TaskTableRows", () => ({
    TaskTableRows: (props: {
        onRequestPreview: (row: TaskTableProps) => void;
        resolveIsSelected: (row: TaskTableProps) => boolean;
    }) => {
        requestPreview = props.onRequestPreview;
        isSelected = props.resolveIsSelected;
        screenRenders++;
        return null;
    },
}));
// What the board hands to its cards.
let clickCard: (row: TaskTableProps) => void = () => {};
let cardSelection: { selectedTaskId?: number | null; selectedMilestoneId?: number | null } = {};
vi.mock("../features/tasks/components/board/SprintBoardColumn", () => ({
    COLUMN_MIN_WIDTH: 240,
    SprintBoardColumn: (props: {
        column: { id: string };
        onTaskClick: (row: TaskTableProps) => void;
        selectedTaskId?: number | null;
        selectedMilestoneId?: number | null;
    }) => {
        if (props.column.id === "open") {
            screenRenders++;
            clickCard = props.onTaskClick;
            cardSelection = {
                selectedTaskId: props.selectedTaskId,
                selectedMilestoneId: props.selectedMilestoneId,
            };
        }
        return null;
    },
}));
// The filter menu normally publishes the filtered rows; here it passes them all.
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
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));
vi.mock("../hooks/tasks/useProjectCustomFields", () => ({
    useProjectCustomFields: () => ({ fields: [] }),
}));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn().mockResolvedValue([]),
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = { userId: "u1", userName: "u1" } as unknown as UserProps;

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

const A = makeRow("42");
const B = makeRow("43");
const C = makeRow("44");
const MILESTONE = makeRow("50", { isMilestone: true, milestoneId: 7 });

const ALL_TASKS = [A, B, C, MILESTONE];

// Every write the click makes to the preview state, in order.
let writes: string[] = [];
// Opens a task the way something other than a click does (a link, the URL).
let openElsewhere: (id: number) => void = () => {};

/** The task-management slice both screens read, with REAL preview state. */
const usePreviewTM = () => {
    const [currentPreviewTaskId, setTaskId] = useState(-1);
    const [currentPreviewMilestoneId, setMilestoneId] = useState(-1);
    const [currentPreviewKind, setKind] = useState<"task" | "milestone">("task");
    const [isTaskPreviewVisible, setVisible] = useState(false);
    openElsewhere = setTaskId;
    return useMemo(
        () => ({
            allTasks: ALL_TASKS,
            setAllTasks: vi.fn(),
            tableMilestoneFilterId: null,
            currentPreviewTask: undefined,
            setCurrentPreviewTask: vi.fn(),
            setIsTaskUpdated: vi.fn(),
            isLoadingTasks: false,
            currentPreviewTaskId,
            currentPreviewMilestoneId,
            currentPreviewKind,
            isTaskPreviewVisible,
            setCurrentPreviewTaskId: (id: number) => {
                writes.push(`task:${id}`);
                setTaskId(id);
            },
            setCurrentPreviewMilestoneId: (id: number) => {
                writes.push(`milestone:${id}`);
                setMilestoneId(id);
            },
            setCurrentPreviewKind: (kind: "task" | "milestone") => setKind(kind),
            setIsTaskPreviewVisible: (v: boolean) => setVisible(v),
        }),
        [currentPreviewTaskId, currentPreviewMilestoneId, currentPreviewKind, isTaskPreviewVisible]
    );
};

const TableHost = () => {
    const useTM = usePreviewTM();
    return (
        <DraggableTaskTable
            myself={myself}
            setMyself={vi.fn()}
            setTeamMembers={vi.fn()}
            socket={null}
            teamMembers={[user]}
            useCM={{} as never}
            usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
            useSM={{ projectSprints: {} } as never}
            useTEM={{} as never}
            useTM={useTM as never}
            useUISM={{} as never}
        />
    );
};
const BoardHost = () => {
    const useTM = usePreviewTM();
    return (
        <SprintBoard
            myself={myself}
            setTeamMembers={vi.fn()}
            teamMemberProfiles={{}}
            teamMembers={[user]}
            usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
            useSM={{} as never}
            useTM={useTM as never}
        />
    );
};

const mount = async (Host: () => React.JSX.Element) => {
    const view = render(
        <CssVarsProvider>
            <Host />
        </CssVarsProvider>
    );
    await act(async () => {});
    writes = [];
    screenRenders = 0;
    return view;
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
    vi.useFakeTimers();
    writes = [];
});
afterEach(() => {
    vi.useRealTimers();
});

describe.each([
    [
        "task table row",
        TableHost,
        (row: TaskTableProps) => act(() => requestPreview(row)),
        (row: TaskTableProps) => isSelected(row),
    ],
    [
        "sprint board card",
        BoardHost,
        (row: TaskTableProps) => act(() => clickCard(row)),
        (row: TaskTableProps) =>
            row.isMilestone
                ? cardSelection.selectedMilestoneId === row.milestoneId
                : cardSelection.selectedTaskId === Number(row.id),
    ],
] as const)("%s", (_name, Host, click, selected) => {
    it("a single click starts the load at once, with no timer needed", async () => {
        await mount(Host);

        click(A);

        expect(writes).toEqual(["task:42"]);
        expect(selected(A)).toBe(true);
        expect(selected(B)).toBe(false);
        // Nothing more happens when the window closes.
        advance(1000);
        expect(writes).toEqual(["task:42"]);
    });

    it("two clicks 50 ms apart: the first loads at once, the second after the window", async () => {
        await mount(Host);

        click(A);
        advance(50);
        click(B);

        // The highlight already follows the second click...
        expect(selected(B)).toBe(true);
        expect(selected(A)).toBe(false);
        // ...but its load waits for the window.
        expect(writes).toEqual(["task:42"]);
        advance(149);
        expect(writes).toEqual(["task:42"]);
        advance(1);
        expect(writes).toEqual(["task:42", "task:43"]);
        expect(selected(B)).toBe(true);
        expect(selected(A)).toBe(false);
    });

    it("five rapid clicks load the first and the last only", async () => {
        await mount(Host);

        for (const row of [A, B, C, A, B]) {
            click(row);
            advance(20);
        }
        advance(500);

        expect(writes).toEqual(["task:42", "task:43"]);
        expect(selected(B)).toBe(true);
    });

    it("once the load has started, the highlight follows the real preview state again", async () => {
        await mount(Host);

        click(A);
        act(() => openElsewhere(43));

        // A stuck "pending" click would keep A highlighted over the real B.
        expect(selected(B)).toBe(true);
        expect(selected(A)).toBe(false);
    });

    it("a milestone is routed the same way", async () => {
        await mount(Host);

        click(MILESTONE);

        expect(writes).toEqual(["milestone:7"]);
        expect(selected(MILESTONE)).toBe(true);
    });

    it("the pending highlight is dropped in the same batch as the load: no render follows the click", async () => {
        await mount(Host);

        click(A);
        const rendersAfterClick = screenRenders;
        advance(1000);

        // Pane visible + load started + pending highlight dropped, together.
        // The pending highlight used to be dropped by a separate effect, a
        // render after the load started (and the load itself a timer later),
        // so renders kept coming after the click.
        expect(screenRenders).toBe(rendersAfterClick);
        expect(selected(A)).toBe(true);
    });

    it("leaving the screen drops a click that is still waiting", async () => {
        const view = await mount(Host);

        click(A);
        advance(50);
        click(B);
        view.unmount();
        advance(1000);

        expect(writes).toEqual(["task:42"]);
    });
});
