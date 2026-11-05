/**
 * The sprint board when the server refuses a status change (MIP-925).
 *
 * Dragging a card to another column moves it optimistically and saves through
 * `updateTaskFromTable`. That helper used to swallow the refusal and hand the
 * row back as if it had been stored, so the `catch` in `handleDragEnd` that
 * rolls the columns back never ran and the card stayed in the column the
 * server had refused. The board is rendered for real; the drag library is
 * replaced by a stub that hands the test `onDragEnd` (jsdom cannot drive a
 * real drag), the columns by a list of card ids per column, and only the
 * transport underneath the real save is stubbed.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SprintBoard } from "../features/tasks/components/board/SprintBoard";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

// The stub that lets the test finish a "drag".
let finishDrag: (result: unknown) => Promise<void> = async () => {};
vi.mock("@hello-pangea/dnd", () => ({
    DragDropContext: ({
        onDragEnd,
        children,
    }: {
        onDragEnd: (result: unknown) => Promise<void> | void;
        children: React.ReactNode;
    }) => {
        finishDrag = async (result) => {
            await onDragEnd(result);
        };
        return <>{children}</>;
    },
    Droppable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({}, {})}</>
    ),
    Draggable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({}, {})}</>
    ),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/components/board/SprintBoardColumn", () => ({
    COLUMN_MIN_WIDTH: 240,
    SprintBoardColumn: ({
        column,
        tasks,
    }: {
        column: { id: string };
        tasks: TaskTableProps[];
    }) => (
        <div data-testid={`column-${column.id}`}>
            {tasks.map((t) => (
                <span key={t.id} data-testid={`card-${t.id}`} />
            ))}
        </div>
    ),
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
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));

const loadSpecificTask = vi.fn();
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: (...args: unknown[]) => loadSpecificTask(...args),
}));
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = { userId: "u1", userName: "u1" } as unknown as UserProps;

const fullTask = (): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", systemUserId: "sys" },
        assignee: user,
        reporter: user,
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
    }) as unknown as TaskProps;

const row = {
    id: "42",
    displayId: "KDS-42",
    title: "A task",
    status: "Open",
    priority: "Medium",
    effortLevel: "Medium",
    dueDate: "",
    projectId: 1,
    parentTaskId: null,
    milestoneId: null,
    isMilestone: false,
    assigneeId: "u1",
    tags: [],
} as unknown as TaskTableProps;

const adapter = vi.fn();
const respondWith = (status: number, data: unknown) => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (status < 400) return { data, status, statusText: "OK", headers: {}, config };
        throw new AxiosError(
            `Request failed with status code ${status}`,
            "ERR_BAD_REQUEST",
            config,
            null,
            { data, status, statusText: "", headers: {}, config }
        );
    });
};

let bus: Array<[string, string | undefined]> = [];
let unsubscribe: () => void = () => {};
let originalAdapter: typeof axios.defaults.adapter;
let now = 0;

beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    loadSpecificTask.mockReset();
    loadSpecificTask.mockResolvedValue([fullTask()]);
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});

afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const columnOf = (id: string) =>
    ["open", "wip", "blocked", "pending", "closed"].find((col) =>
        screen.getByTestId(`column-${col}`).contains(screen.queryByTestId(`card-${id}`))
    );

const renderBoard = () => {
    const useTM = {
        allTasks: [row],
        setAllTasks: vi.fn(),
        tableMilestoneFilterId: null,
        currentPreviewTask: undefined,
        setCurrentPreviewTask: vi.fn(),
    };
    render(
        <CssVarsProvider>
            <SprintBoard
                myself={myself}
                setTeamMembers={vi.fn()}
                teamMemberProfiles={{}}
                teamMembers={[user]}
                usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
                useSM={{ projectMilestones: {}, projectSprints: {} } as never}
                useTM={useTM as never}
            />
        </CssVarsProvider>
    );
    return { useTM };
};

const dragOpenToWip = () =>
    act(() =>
        finishDrag({
            source: { droppableId: "open", index: 0 },
            destination: { droppableId: "wip", index: 0 },
            draggableId: "42",
        })
    );

describe("dragging a card on the sprint board", () => {
    it("puts the card back and shows the server's reason when the status change is refused", async () => {
        const reason = "custom field 7 must be a number.";
        respondWith(400, { error: reason });
        const { useTM } = renderBoard();
        await waitFor(() => expect(columnOf("42")).toBe("open"));

        await dragOpenToWip();

        // Vacuity guard: the save was really attempted with the new status.
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(JSON.parse(adapter.mock.calls[0][0].data).status).toBe("WIP");
        // The board went back, the table state was never told the move stuck.
        await waitFor(() => expect(columnOf("42")).toBe("open"));
        expect(useTM.setAllTasks).not.toHaveBeenCalled();
        expect(bus[bus.length - 1]).toEqual(["serverMessage", reason]);
    });

    it("leaves the card in its new column when the save is accepted (the harness can show a stuck move)", async () => {
        respondWith(200, { task: { ts_updated_at: "now" } });
        const { useTM } = renderBoard();
        await waitFor(() => expect(columnOf("42")).toBe("open"));

        await dragOpenToWip();

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(columnOf("42")).toBe("wip");
        expect(useTM.setAllTasks).toHaveBeenCalledTimes(1);
        expect(bus).toEqual([]);
    });
});
